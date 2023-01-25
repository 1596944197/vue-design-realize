/**
 * # 渲染器
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function renderer(vNode: RenderType, container: HTMLElement) {
  if (typeof vNode.tag === 'string') mountElement(vNode, container)

  else mountComponent(vNode, container)
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @param {unknown} tag
 * @returns {tag is () => RenderType}
 */
function isFunc(tag: unknown): tag is () => RenderType {
  return typeof tag === 'function'
}

/**
 * # 渲染实体元素
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function mountElement(vNode: RenderType, container: HTMLElement) {
  // 使用 vNode.tag 作为标签名称创建 DOM 元素
  const el = document.createElement(vNode.tag as string)
  // 遍历 vNode.props，将属性、事件添加到 DOM 元素
  for (const key in vNode.props) {
    if (/^on/.test(key)) {
      // 如果 key 以 on 开头，说明它是事件
      el.addEventListener(
        key.substring(2).toLowerCase(), // 事件名称 onClick ---> click
        vNode.props[key] // 事件处理函数
      )
    }
  }

  // 处理 children
  if (typeof vNode.children === 'string') {
    // 如果 children 是字符串，说明它是元素的文本子节点
    el.appendChild(document.createTextNode(vNode.children))
  } else if (Array.isArray(vNode.children)) {
    // 递归地调用 renderer 函数渲染子节点，使用当前元素 el 作为挂载点
    vNode.children.forEach(child => renderer(child, el))
  }

  // 将元素添加到挂载点下
  container.appendChild(el)
}

/**
 * # 渲染组件
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function mountComponent(vNode: RenderType, container: HTMLElement) {
  if (isFunc(vNode.tag)) {
    const subTree = vNode.tag()

    renderer(subTree, container)
  } else if (isFunc(vNode.render)) {
    const subTree = vNode.render()

    renderer(subTree, container)
  }
}


renderer({
  tag: 'div',
  children: [
    { tag: 'span', children: 'hello world' },
    {
      tag: 'h2',
      props: {
        onClick(...ev) { alert(2123) }
      },
      children: [
        { tag: 'span', children: '测试' }
      ]
    },
  ]
}, document.body)



// # 响应式系统内容
// ! 常量属性start
let activeEffect: ActiveEffectType

const effectStack: ActiveEffectType[] = []

const bucket = new WeakMap<Object, Map<string | symbol, Set<ActiveEffectType>>>()

// # for in 操作标识
const ITERATE_KEY = Symbol()
// ! 常量属性end

const source = {
  a: 'abcd',
  ok: true,
  text: 'hello world',
  fff: 2,
  value: 0xff,
  get bar() {
    return this.value
  },
  nan: NaN
}

const f1 = { foo: { bar: { a: 1, b: 2 } } }

const array = [1, 2, 3, 4, 5]

const obj = reactive(source)

// # 测试继承、只读、浅响应等
const child = shallowReadonlyReactive(f1)

const arr = reactive(array)

enum CurrentSetType {
  ADD = 'ADD',
  SET = 'SET',
  DELETE = 'DELETE'
}


function reactive<T extends AnyObject, O extends ReactiveOptions>(source: T, options?: O): ReactiveObject<T, O> {
  return new Proxy<ReactiveObject<T, O>>(source, {
    get(target, p, receiver) {
      if (p === '_sourceObj') {
        return target
      }

      // #为了避免发生意外的错误，以及性能上的考虑，我们不应该在副作用函数与 Symbol.iterator 这类 symbol 值之间建立响应联系
      if (!options?.isReadonly && typeof p !== 'symbol') track(target, p)

      const response = Reflect.get(target, p, receiver)

      if (typeof response === 'object' && !Object.is(response, NaN) && !options?.isShallow) {
        return options?.isReadonly ? reactive(response, options) : reactive(response)
      }

      return response
    },
    set(target, p: string, value, receiver) {
      if (options?.isReadonly) {
        console.warn(`属性${p}是只读的`)
        return true
      }

      const oldVal = target[p]

      const type = Array.isArray(target) ? +p >= target.length ? CurrentSetType['ADD'] : CurrentSetType['SET'] : Object.prototype.hasOwnProperty.call(target, p) ? CurrentSetType['SET'] : CurrentSetType['ADD']

      const r = Reflect.set(target, p, value, receiver)

      // # 避免当原型也是响应式数据时，多次触发更新
      if (!Object.is(target, receiver._sourceObj)) return r

      if (!Object.is(oldVal, value)) {
        trigger(target, p, type, value)
      }

      return r
    },
    deleteProperty(target, p: string) {
      if (options?.isReadonly) {
        console.warn(`属性${p}是只读的`)
        return true
      }

      const r = Reflect.deleteProperty(target, p)

      const type = Object.hasOwnProperty.call(target, p) ? CurrentSetType['DELETE'] : null

      if (r && type === CurrentSetType['DELETE']) trigger(target, p, type)

      return r
    },
    has(target, p) {
      track(target, p)
      return Reflect.has(target, p)
    },
    ownKeys(target) {
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
  })
}



function shallowReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isShallow: true
  })
}


function readonlyReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isReadonly: true
  })
}


function shallowReadonlyReactive<T extends AnyObject>(source: T) {
  return reactive(source, {
    isReadonly: true,
    isShallow: true,
  })
}

/**
 * # 跟踪数据
 * @param {target} 代理对象 
 * @param {p} 访问的属性
 * @returns {} void
 */
function track(target, p) {
  // # 没有 activeEffect，直接 return

  // if (!activeEffect) return Reflect.get(target, p)
  if (!activeEffect) return

  let depsMap = bucket.get(target)

  if (!depsMap) bucket.set(target, (depsMap = new Map))

  let deps = depsMap.get(p)

  if (!deps) depsMap.set(p, (deps = new Set()))

  // # 把当前激活的副作用函数添加到依赖集合 deps 中
  deps.add(activeEffect)

  // # deps 就是一个与当前副作用函数存在联系的依赖集合
  // # 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}

/**
 * # 触发副作用函数
 * @param target 代理对象 
 * @param p 访问的属性
 * @returns  void
 */
function trigger(target, p, type?: CurrentSetType, newVal?) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  let deps = new Set(depsMap.get(p))

  if (type === CurrentSetType['ADD'] || type === CurrentSetType['DELETE']) {
    // # 只有当给对象添加属性时，才会触发 for in相关操作
    depsMap.get(ITERATE_KEY)?.forEach(v => v && deps.add(v))

    // # 当涉及到数组的增加和修改操作时，触发length的相关回调
    if (Array.isArray(target)) {
      depsMap.get('length')?.forEach(v => v && deps.add(v))
    }
  }

  // # 当数组的length属性变更时，检测是否需要触发回调
  if (Array.isArray(target) && p === 'length') {
    depsMap.forEach((effectHandlerSet, key) => {
      if (typeof key === 'symbol') return
      if (+key >= newVal) {
        effectHandlerSet.forEach(v => v && deps.add(v))
      }
    })
  }

  // # 当前活动的副作用函数如何与遍历出来的副作用函数相同，则取消执行
  deps.forEach(effectHandler => {
    if (activeEffect === effectHandler) return

    if (effectHandler.options?.scheduler) {
      effectHandler.options?.scheduler(effectHandler)
    } else {
      effectHandler()
    }
  })

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
    cleanup(effectHandler)

    //# 当调用 effect 注册副作用函数时，将副作用函数赋值给 activeEffect
    activeEffect = effectHandler

    //# 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(activeEffect)

    const result: ReturnType<T> = func()

    //# 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

    return result
  }

  // # 将选项挂载 到options上面
  effectHandler.options = options

  // # 初始化该副作用函数的依赖集合
  effectHandler.deps = []

  if (!options?.lazy) {
    effectHandler()
  }

  return effectHandler
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @param {ActiveEffectType} effectHandler
 */
function cleanup(effectHandler: ActiveEffectType) {
  if (!effectHandler.deps.length) return
  effectHandler.deps.forEach(dep => dep.delete(effectHandler))

  effectHandler.deps.length = 0
}


//# 定义一个任务队列
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {*}
 */
const jobQueue = new Set<Function>()

//# 一个标志代表是否正在刷新队列
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {boolean}
 */
let isFlushing = false

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 */
function flushJob() {
  //# 如果队列正在刷新，则什么都不做
  if (isFlushing) return

  isFlushing = true

  Promise.resolve().then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    //# 结束后重置 isFlushing
    isFlushing = false
  })
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
function watch<T extends () => any, Cb extends WatchCallback>(source: T, callback: Cb, options?: WatchOptions);
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
function watch<T extends AnyObject, Cb extends WatchCallback>(source: T, callback: Cb, options?: WatchOptions);
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
function watch<T extends AnyObject, Cb extends WatchCallback>(source: T, callback: Cb, options?: WatchOptions) {
  // 定义 getter
  let getter: Function
  // 如果 source 是函数，说明用户传递的是 getter，所以直接把  source 赋值给 getter
  if (typeof source === 'function') {
    getter = source
  } else {
    // 否则按照原来的实现调用 traverse 递归地读取
    getter = () => traverse(source)
  }

  let newVal, oldVal


  let cleanup: Function;

  // 定义 onInvalidate 函数
  function onInvalidate(fn: Function) {
    // 将过期回调存储到 cleanup 中
    cleanup = fn
  }

  const job = () => {
    newVal = effectHandler()

    //# 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) cleanup()
    callback(newVal, oldVal, onInvalidate)
    oldVal = newVal
  }

  const effectHandler = effect(() => getter(), {
    lazy: true,
    scheduler(effectHandler) {
      // # post代表异步？
      if (options?.flush === 'post') {
        Promise.resolve().then(job)
      } else {
        job()
      }
    },
  })

  if (options?.immediate) {
    job()
  } else {
    oldVal = effectHandler()
  }

  function traverse(value, seen = new Set()) {
    // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
    seen.add(value)
    // 暂时不考虑数组等其他结构
    // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地调用 traverse 进行处理
    for (const k in value) {
      traverse(value[k], seen)
    }
    return value
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
  let value: ReturnType<T>
  let dirty = true //# 脏值检测

  //# 把 getter 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(getter, {
    lazy: true,
    //# 添加调度器，在调度器中将 dirty 重置为 true
    scheduler() {
      dirty = true
      trigger(obj, 'value')
    },
  })

  const obj = {
    //# 当读取 value 时才执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return value
    }
  }
  return obj
}



// # 避免不必要的执行
effect(() => {
  document.body.innerHTML = `<h2>${obj.ok ? obj.text : 'nothing'}</h2>`
})

// # 避免嵌套的副作用函数无法正确捕获
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {*}
 */
let temp1, temp2
effect(function effectFn1() {
  'effectFn1 执行'
  effect(function effectFn2() {
    'effectFn2 执行'
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = obj.bar
  })
  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = obj.foo
})

// # 避免无限递归循环
effect(() => {
  obj.fff
})

// # 可控制的执行时机
effect(() => {
  obj.fff
}, {
  scheduler(effectHandler) {
    jobQueue.add(effectHandler)
    flushJob()
  },
})

++obj.fff
++obj.fff
++obj.fff


// # 懒执行的副作用函数-
/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {{ (): any; options: any; deps: {}; }}
 */
const res = effect(() => {
  obj.fff++
}, {
  lazy: true
})
res()


/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @type {{ readonly value: any; }}
 */
const r = computed(() => obj.fff * obj.fff)

effect(() => {
  r.value
})

obj.fff++

watch(obj, () => {
  '监听对象'
})

watch(() => obj.text, (n, o) => {
  n; o
}, {
  immediate: true
})


obj.text = '2323232424242'

effect(() => obj.bar)

obj.value++


effect(() => {
  for (const iterator of arr) {
    console.log(iterator)
  }
})

arr[100] = 0xff
arr.length = 1