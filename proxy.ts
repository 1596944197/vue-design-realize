// # 响应式系统内容
// ! 常量属性start
let activeEffect: ActiveEffectType;

const effectStack: ActiveEffectType[] = [];

const bucket = new WeakMap<
  Object,
  Map<string | symbol, Set<ActiveEffectType>>
>();

// # for in 操作标识
const ITERATE_KEY = Symbol();

// # 定义一个 Map 实例，存储原始对象到代理对象的映射
const reactiveMap = new Map();

// # proxy的源对象，使用symbol来决定
const sourceObj = Symbol("source_obj");

// # 为了避免数组调用原生方法时出现的错误引用问题，数组需要拦截特定字段方法执行
let shouldTrack = true;
const ArrayInterceptor = (() => {
  const ArrayInterceptorHandler = (method) => {
    return function l(this: any, ...args: any) {
      const originMethod = Array.prototype[method];

      //# 首先在代理对象中找 / 此步骤是否可以省略？
      let res = originMethod.apply(this, args);

      if (!res) {
        // # 没找到再到原始对象中找
        res = originMethod.apply(this[sourceObj], args);
      }
      // 返回最终结果
      return res;
    };
  };
  const ArrayInterceptorHandlerByLength = (method) => {
    return function p(this: any, ...args: any) {
      const originMethod = Array.prototype[method];
      shouldTrack = false;
      let res = originMethod.apply(this, args);
      shouldTrack = true;
      return res;
    };
  };
  return {
    ...["includes", "indexOf", "lastIndexOf"].reduce(
      (pre, cur) => ({
        ...pre,
        [cur]: ArrayInterceptorHandler(cur),
      }),
      {}
    ),
    ...["push", "pop", "shift", "unshift", "splice"].reduce(
      (pre, cur) => ({
        ...pre,
        [cur]: ArrayInterceptorHandlerByLength(cur),
      }),
      {}
    ),
  };
})();

// # 为了避免Set和Map原生方法的错误执行，进行拦截字段
const ES6SetInterceptor = (() => {
  const SetInterceptorHandler = (method) => {
    return function l(this: any, ...args: any) {
      const originMethod = Set.prototype[method];

      const target = this[sourceObj];

      const oldSize = target.size;

      // # 没找到再到原始对象中找
      let res = originMethod.apply(target, args);

      if (oldSize > this.size) {
        trigger(target, "size", CurrentSetType["DELETE"]);
      }
      if (oldSize < this.size) {
        trigger(target, "size", CurrentSetType["ADD"]);
      }

      // 返回最终结果
      return res;
    };
  };

  const forEach = function l<T extends Set<any>>(
    this: T,
    callback: Function,
    thisArg?: any
  ) {
    const target: T = this[sourceObj];

    const wrap = (v) => (typeof v === "object" ? reactive(v) : v);

    // # 不管怎样，都是跟踪源数据，而不是跟踪传入的thisArg
    track(target, ITERATE_KEY);

    if (thisArg) {
      thisArg.forEach((value, index) => {
        const t = thisArg || this;

        callback.call(t, wrap(value), wrap(index), this);
      }, thisArg);
    } else {
      target.forEach((value, index) => {
        const t = thisArg || this;

        callback.call(t, wrap(value), wrap(index), this);
      }, target);
    }
  };

  return {
    ...["has", "delete", "add"].reduce(
      (pre, cur) => ({
        ...pre,
        [cur]: SetInterceptorHandler(cur),
      }),
      {}
    ),
    forEach,
    [Symbol.iterator]: () => {},
  };
})();

/**
 * ### 包装属性
 * @date 2023/2/11 - 10:37:44
 *
 * @template T
 * @param {T} v
 * @returns {*}
 */
function wrap<T>(v: T) {
  return typeof v === "object" && v !== null ? reactive(v) : v;
}

const ES6MapInterceptor = (() => {
  const MapInterceptorHandler = (method) => {
    return function l(this: any, ...args: any) {
      const originMethod = Map.prototype[method];

      const target = this[sourceObj];

      const oldSize = target.size;

      // # 没找到再到原始对象中找
      const res = originMethod.apply(target, args);

      if (oldSize > this.size) {
        trigger(target, "size", CurrentSetType["DELETE"]);
      }
      if (oldSize < this.size) {
        trigger(target, "size", CurrentSetType["ADD"]);
      }

      // 返回最终结果
      return res;
    };
  };
  const get = function l(this: any, key) {
    const target: Map<any, any> = this[sourceObj];

    const had = target.has(key);
    // 追踪依赖，建立响应联系
    track(target, key);
    // 如果存在，则返回结果。这里要注意的是，如果得到的结果 res 仍然是可代理的数据，
    // 则要返回使用 reactive 包装后的响应式数据
    if (had) {
      const res = target.get(key);
      return typeof res === "object" ? reactive(res) : res;
    }
  };
  const set = function l(this: any, key, value) {
    const target: Map<any, any> = this[sourceObj];

    const had = target.has(key);

    const oldVal = had ? target.get(key) : undefined;

    // # 解决污染原始数据，当检测到即将设置的值是响应式对象时，进行判定
    const res = target.set(key, value[sourceObj] ? value[sourceObj] : value);

    const newVal = target.get(key);

    if (!Object.is(oldVal, newVal)) {
      if (had) {
        trigger(target, key, CurrentSetType["SET"]);
      } else {
        trigger(target, key, CurrentSetType["ADD"]);
      }
    }
    return res;
  };
  const forEach = function l<T extends Map<any, any>>(
    this: T,
    callback: Function,
    thisArg?
  ) {
    const target: T = this[sourceObj];

    track(target, ITERATE_KEY);

    target.forEach((v, i, t) => {
      callback.call(this, wrap(v), wrap(i), t);
    });
  };
  const iterationHandler = function l(this: any) {
    const target = this[sourceObj];

    const iterator = target[Symbol.iterator]();

    track(target, ITERATE_KEY);

    return {
      next() {
        // 调用原始迭代器的 next 方法获取 value 和 done
        const { value, done } = iterator.next();
        return {
          // 如果 value 不是 undefined，则对其进行包裹
          value: value ? [wrap(value[0]), wrap(value[1])] : value,
          done,
        };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  };
  const keysHandler = function l(this: any) {
    const target = this[sourceObj];

    const iterator = target[Symbol.iterator]();

    track(target, ITERATE_KEY);

    return {
      next() {
        // 调用原始迭代器的 next 方法获取 value 和 done
        const { value, done } = iterator.next();
        return {
          // 如果 value 不是 undefined，则对其进行包裹
          value: value && wrap(value[0]),
          done,
        };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  };
  return {
    ...["delete", "has"].reduce(
      (pre, cur) => ({
        ...pre,
        [cur]: MapInterceptorHandler(cur),
      }),
      {}
    ),
    get,
    set,
    forEach,
    [Symbol.iterator]: iterationHandler,
    entries: iterationHandler,
    keys: keysHandler,
  };
})();

/**
 * ### 获取数据的类型
 * @date 2023/1/31 - 14:20:37
 *
 * @param {*} obj
 * @returns {String}
 */
function getType(obj: any) {
  let type = Object.prototype.toString
    .call(obj)!
    .match(/^\[object (.*)\]$/)![1]
    .toLowerCase();
  if (type === "string" && typeof obj === "object") return "object"; // Let "new String('')" return 'object'
  if (obj === null) return "null"; // PhantomJS has type "DOMWindow" for null
  if (obj === undefined) return "undefined"; // PhantomJS has type "DOMWindow" for undefined
  return type;
}

const isRef = "_isRef";

// ! 常量属性end

const source = {
  a: "abcd",
  ok: true,
  text: "hello world",
  fff: 2,
  value: 0xff,
  get bar() {
    return this.value;
  },
  nan: NaN,
};

const f1 = { foo: { bar: { a: 1, b: 2 } } };

const obj = reactive(f1);

// # 测试继承、只读、浅响应等
const child = shallowReadonlyReactive(f1);

const arr = reactive([1, 2, 3, 4, 5]);

const a1 = { a: 1 };
const testInclude = reactive([a1]);

const s1 = new Set([1, 0x11, 0x22]);
const testSet = reactive(s1);

const m1 = new Map([[0x1f, 1]]);
const testMap = reactive(m1);

enum CurrentSetType {
  ADD = "ADD",
  SET = "SET",
  DELETE = "DELETE",
}

function reactive<T extends AnyObject, O extends ReactiveOptions>(
  source: T,
  options?: O
): ReactiveObject<T, O> {
  if (reactiveMap.has(source)) return reactiveMap.get(source);

  const reactiveObject = new Proxy(source, {
    get(target, p, receiver) {
      if (p === sourceObj) {
        return target;
      }

      if (
        typeof p === "string" &&
        Array.isArray(target) &&
        ArrayInterceptor[p]
      ) {
        return Reflect.get(ArrayInterceptor, p, receiver);
      }

      if (getType(target) === "set") {
        if (p === "size") {
          track(target, p);
          return Reflect.get(target, p, target);
        }
        return Reflect.get(ES6SetInterceptor, p, receiver);
      }

      if (getType(target) === "map") {
        if (p === "size") {
          track(target, p);
          return Reflect.get(target, p, target);
        }
        return Reflect.get(ES6MapInterceptor, p, receiver);
      }

      // #为了避免发生意外的错误，以及性能上的考虑，我们不应该在副作用函数与 Symbol.iterator 这类 symbol 值之间建立响应联系
      if (!options?.isReadonly && typeof p !== "symbol") track(target, p);

      const response = Reflect.get(target, p, receiver);

      if (response?.[isRef]) {
        return Reflect.get(response, `value`);
      }

      if (
        typeof response === "object" &&
        !Object.is(response, NaN) &&
        !options?.isShallow
      ) {
        // ! 等待改良response类型
        return options?.isReadonly
          ? reactive(response as any, options)
          : reactive(response as any);
      }

      return response;
    },
    set(target, p: string, value, receiver) {
      if (options?.isReadonly) {
        console.warn(`属性${p}是只读的`);
        return true;
      }

      const oldVal = target[p];

      const type = Array.isArray(target)
        ? +p >= target.length
          ? CurrentSetType["ADD"]
          : CurrentSetType["SET"]
        : Object.prototype.hasOwnProperty.call(target, p)
        ? CurrentSetType["SET"]
        : CurrentSetType["ADD"];

      const r = Reflect.set(target, p, value, receiver);

      // # 避免当原型也是响应式数据时，多次触发更新
      if (!Object.is(target, receiver[sourceObj])) return r;

      if (!Object.is(oldVal, value)) {
        trigger(target, p, type, value);
      }

      return r;
    },
    deleteProperty(target, p: string) {
      if (options?.isReadonly) {
        console.warn(`属性${p}是只读的`);
        return true;
      }

      const r = Reflect.deleteProperty(target, p);

      const type = Object.hasOwnProperty.call(target, p)
        ? CurrentSetType["DELETE"]
        : null;

      if (r && type === CurrentSetType["DELETE"]) trigger(target, p, type);

      return r;
    },
    has(target, p) {
      track(target, p);
      return Reflect.has(target, p);
    },
    ownKeys(target) {
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });

  reactiveMap.set(source, reactiveObject);

  return reactiveObject;
}

function shallowReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isShallow: true,
  });
}

function readonlyReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isReadonly: true,
  });
}

function shallowReadonlyReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isReadonly: true,
    isShallow: true,
  });
}

function ref<T>(Val: T) {
  const wrapper = {
    value: Val,
  };
  Object.defineProperty(wrapper, isRef, {
    value: true,
    writable: false,
  });
  return reactive(wrapper as { value: T; _isRef: true });
}

function toRef<T extends Object>(obj: T, key) {
  const wrapper = {
    get [key]() {
      return obj[key];
    },
  };
  Object.defineProperty(wrapper, isRef, {
    value: true,
    writable: true,
  });
  return ref(obj[key]);
}

function toRefs<T extends AnyObject>(obj: T) {
  const result: any = {};
  for (const key in obj) {
    result[key] = ref(obj[key]);
  }

  return result as {
    [K in keyof T]: {
      value: T[K];
      _isRef: true;
    };
  };
}

function toProxyRefs<T extends AnyObject>(source: T): ToProxyRefsType<T> {
  const proxy = new Proxy(source, {
    get(target, p, receiver) {
      track(target, p);
      const response = Reflect.get(target, p, receiver);

      if (response?.[isRef]) {
        return Reflect.get(response, "value");
      }

      return response;
    },
    set(target, p: string, newValue, receiver) {
      const v = target[p];
      let value: boolean;
      if (v[isRef]) {
        value = Reflect.set(v, "value", newValue);
      } else {
        value = Reflect.set(target, p, newValue, receiver);
      }

      return value;
    },
  });

  return proxy;
}

const rrrr = toProxyRefs({ ...toRefs({ a: 1, b: 2, c: 3, d: 4 }) });

effect(() => {
  rrrr.b;
});

rrrr.b = 0xff;

/**
 * # 跟踪数据
 * @param {target} 代理对象
 * @param {p} 访问的属性
 * @returns {} void
 */
function track(target, p) {
  // # 没有 activeEffect，直接 return

  // if (!activeEffect) return Reflect.get(target, p)
  if (!activeEffect || !shouldTrack) return;

  let depsMap = bucket.get(target);

  if (!depsMap) bucket.set(target, (depsMap = new Map()));

  let deps = depsMap.get(p);

  if (!deps) depsMap.set(p, (deps = new Set()));

  // # 把当前激活的副作用函数添加到依赖集合 deps 中
  deps.add(activeEffect);

  // # deps 就是一个与当前副作用函数存在联系的依赖集合
  // # 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps);
}

/**
 * # 触发副作用函数
 * @param target 代理对象
 * @param p 访问的属性
 * @returns  void
 */
function trigger(target, p, type?: CurrentSetType, newVal?) {
  const depsMap = bucket.get(target);

  if (!depsMap) return;

  let deps = new Set(depsMap.get(p));

  if (
    type === CurrentSetType["ADD"] ||
    type === CurrentSetType["DELETE"] ||
    (type === CurrentSetType["SET"] && getType(target) === "map")
  ) {
    // # 只有当给对象添加属性时，才会触发 for in相关操作
    depsMap.get(ITERATE_KEY)?.forEach((v) => v && deps.add(v));

    // # 当涉及到数组的增加和修改操作时，触发length的相关回调
    if (Array.isArray(target)) {
      depsMap.get("length")?.forEach((v) => v && deps.add(v));
    }

    // # 当涉及到map的size属性修改
    if (getType(target) === "map") {
      depsMap.get("size")?.forEach((v) => v && deps.add(v));
    }
  }

  // # 当数组的length属性变更时，检测是否需要触发回调
  if (Array.isArray(target) && p === "length") {
    depsMap.forEach((effectHandlerSet, key) => {
      if (typeof key === "symbol") return;
      if (+key >= newVal) {
        effectHandlerSet.forEach((v) => v && deps.add(v));
      }
    });
  }

  // # 当前活动的副作用函数如何与遍历出来的副作用函数相同，则取消执行
  deps.forEach((effectHandler) => {
    if (activeEffect === effectHandler) return;

    if (effectHandler.options?.scheduler) {
      effectHandler.options?.scheduler(effectHandler);
    } else {
      effectHandler();
    }
  });

  /**
   * # 在调用 forEach 遍历 Set 集合时，如果一个值已经被访问过了，
   * # 但该值被删除并重新添加到集合，如果此时 forEach 遍历没有结束，
   * # 那么该值会重新被访问。因此，上面的代码会无限执行。
   * # 根据书上解决方法之一是用set再包裹一层
   * const deps = depsMap.get(p)
   * deps && deps.forEach(func => func())
   */
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @template T extends EffectFunc
 * @param {T} func
 * @param {?EffectOptions} [options]
 * @returns {{ (): any; options: any; deps: {}; }}
 */
function effect<T extends EffectFunc>(func: T, options?: EffectOptions) {
  const effectHandler = () => {
    cleanup(effectHandler);

    //# 当调用 effect 注册副作用函数时，将副作用函数赋值给 activeEffect
    activeEffect = effectHandler;

    //# 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(activeEffect);

    const result: ReturnType<T> = func();

    //# 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];

    return result;
  };

  // # 将选项挂载 到options上面
  effectHandler.options = options;

  // # 初始化该副作用函数的依赖集合
  effectHandler.deps = [];

  if (!options?.lazy) {
    effectHandler();
  }

  return effectHandler;
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @param {ActiveEffectType} effectHandler
 */
function cleanup(effectHandler: ActiveEffectType) {
  if (!effectHandler.deps.length) return;
  effectHandler.deps.forEach((dep) => dep.delete(effectHandler));

  effectHandler.deps.length = 0;
}

//# 定义一个任务队列
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {*}
 */
const jobQueue = new Set<Function>();

//# 一个标志代表是否正在刷新队列
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {boolean}
 */
let isFlushing = false;

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 */
function flushJob() {
  //# 如果队列正在刷新，则什么都不做
  if (isFlushing) return;

  isFlushing = true;

  Promise.resolve()
    .then(() => {
      jobQueue.forEach((job) => job());
    })
    .finally(() => {
      //# 结束后重置 isFlushing
      isFlushing = false;
    });
}

// # 简易的watch函数
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @template T extends () => any
 * @template Cb extends WatchCallback
 * @param {T} source
 * @param {Cb} callback
 * @param {?WatchOptions} [options]
 * @returns {any, Cb extends any>(source: T, callback: Cb, options?: any): any; <T extends any, Cb extends any>(source: T, callback: Cb, options?: any): any; }}
 */
function watch<T extends () => any, Cb extends WatchCallback>(
  source: T,
  callback: Cb,
  options?: WatchOptions
);
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @template T extends AnyObject
 * @template Cb extends WatchCallback
 * @param {T} source
 * @param {Cb} callback
 * @param {?WatchOptions} [options]
 * @returns {any, Cb extends any>(source: T, callback: Cb, options?: any): any; <T extends any, Cb extends any>(source: T, callback: Cb, options?: any): any; }}
 */
function watch<T extends AnyObject, Cb extends WatchCallback>(
  source: T,
  callback: Cb,
  options?: WatchOptions
);
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @template T extends AnyObject
 * @template Cb extends WatchCallback
 * @param {T} source
 * @param {Cb} callback
 * @param {?WatchOptions} [options]
 * @returns {any, Cb extends any>(source: T, callback: Cb, options?: any): any; <T extends any, Cb extends any>(source: T, callback: Cb, options?: any): any; }}
 */
function watch<T extends AnyObject, Cb extends WatchCallback>(
  source: T,
  callback: Cb,
  options?: WatchOptions
) {
  // 定义 getter
  let getter: Function;
  // 如果 source 是函数，说明用户传递的是 getter，所以直接把  source 赋值给 getter
  if (typeof source === "function") {
    getter = source;
  } else {
    // 否则按照原来的实现调用 traverse 递归地读取
    getter = () => traverse(source);
  }

  let newVal, oldVal;

  let cleanup: Function;

  // 定义 onInvalidate 函数
  function onInvalidate(fn: Function) {
    // 将过期回调存储到 cleanup 中
    cleanup = fn;
  }

  const job = () => {
    newVal = effectHandler();

    //# 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) cleanup();
    callback(newVal, oldVal, onInvalidate);
    oldVal = newVal;
  };

  const effectHandler = effect(() => getter(), {
    lazy: true,
    scheduler(effectHandler) {
      // # post代表异步？
      if (options?.flush === "post") {
        Promise.resolve().then(job);
      } else {
        job();
      }
    },
  });

  if (options?.immediate) {
    job();
  } else {
    oldVal = effectHandler();
  }

  function traverse(value, seen = new Set()) {
    // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
    seen.add(value);
    // 暂时不考虑数组等其他结构
    // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地调用 traverse 进行处理
    for (const k in value) {
      traverse(value[k], seen);
    }
    return value;
  }
}

// # 简易的computed属性
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @template T extends EffectFunc
 * @param {T} getter
 * @returns {{ readonly value: any; }}
 */
function computed<T extends EffectFunc>(getter: T) {
  let value: ReturnType<T>;
  let dirty = true; //# 脏值检测

  //# 把 getter 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(getter, {
    lazy: true,
    //# 添加调度器，在调度器中将 dirty 重置为 true
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    },
  });

  const obj = {
    //# 当读取 value 时才执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };
  return obj;
}

// # 避免不必要的执行
effect(() => {
  document.body.innerHTML = `<h2>${obj.ok ? obj.text : "nothing"}</h2>`;
});

// # 避免嵌套的副作用函数无法正确捕获
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {*}
 */
let temp1, temp2;
effect(function effectFn1() {
  "effectFn1 执行";
  effect(function effectFn2() {
    "effectFn2 执行";
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = obj.bar;
  });
  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = obj.foo;
});

// # 避免无限递归循环
effect(() => {
  obj.fff;
});

// # 可控制的执行时机
effect(
  () => {
    obj.fff;
  },
  {
    scheduler(effectHandler) {
      jobQueue.add(effectHandler);
      flushJob();
    },
  }
);

++obj.fff;
++obj.fff;
++obj.fff;

// # 懒执行的副作用函数-
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {{ (): any; options: any; deps: {}; }}
 */
const res = effect(
  () => {
    obj.fff++;
  },
  {
    lazy: true,
  }
);
res();

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {{ readonly value: any; }}
 */
const r = computed(() => obj.fff * obj.fff);

effect(() => {
  r.value;
});

obj.fff++;

watch(obj, () => {
  "监听对象";
});

watch(
  () => obj.text,
  (n, o) => {
    n;
    o;
  },
  {
    immediate: true,
  }
);

obj.text = "2323232424242";

effect(() => obj.bar);

obj.value++;

effect(() => {
  for (const iterator of arr.values()) {
    iterator;
  }
});

arr[10] = 0xff;

effect(() => {
  testInclude.includes(a1);
});

effect(() => {
  arr.push(0x22);
});

effect(() => {
  arr.push(0x33);
});

effect(() => {
  testSet.forEach(function l(value, index, that) {
    value;
    index;
  }, new Set([2, 5, 8, 9]));
});
testSet.add(111);

testSet.delete(111);

effect(() => {
  testMap.size;
});

testMap.set(0x11, 2); // 触发响应

effect(() => {
  testMap.forEach(function l(v, i, t) {});
});

testMap.set(0x11, 66);

effect(() => {
  for (const iterator of testMap.keys()) {
    iterator;
  }
});

testMap.set(0xff, 100);
