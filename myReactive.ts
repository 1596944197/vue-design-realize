/// <reference path="./global.d.ts" />

/**
 * ### 用于实现响应式功能-最简demo
 */
export namespace MyReactive {
  // ! 常量start
  /**
   * #### 用于存储响应式对象的键对应的副作用函数
   */
  const Buckets = new WeakMap<AnyObject, Map<keyof any, Set<Function>>>()

  let activeEffect

  const sourceObj = 'sourceObj'

  const ArrayInterceptorFields = ['includes', 'indexOf']
  const ArrayInterceptorHandler = (() => {
    const handler = (method) => function l(this: AnyObject, ...args) {
      const h = Array.prototype[method]
      if (!h) return
      return h.apply(this[sourceObj], args)
    }
    return {
      ...ArrayInterceptorFields.reduce((pre, cur) => ({
        ...pre,
        [cur]: handler(cur)
      }), {})
    }
  })()

  const MapInterceptorFields = ['forEach', 'set']
  const MapInterceptorHandler = (() => {
    const handler = (method) => function l(this: AnyObject, ...args) {
      const h = Map.prototype[method]
      if (!h) return
      return h.apply(this[sourceObj], args)
    }
    const forEach = function l(this: AnyObject, ...args) {
      const cb = arguments[0]
      const target = this[sourceObj]

      target.forEach((v, k) => {
        cb(wrap(v), wrap(k), this)
      })
    }
    const set = function l(this: AnyObject, ...args) {
      const [key, value] = arguments
      const target: Map<any, any> = this[sourceObj]

      if (!target.get(key)) track(target, key)

      trigger(target, CurrentSetType['SET'])
      return target.set(key, value)
    }
    return {
      ...MapInterceptorFields.reduce((pre, cur) => ({
        ...pre,
        [cur]: handler(cur)
      }), {}),
      forEach,
      set
    }
  })()


  enum CurrentSetType {
    ADD = "ADD",
    SET = "SET",
    DELETE = "DELETE",
  }
  // ! 常量end

  const f1 = {
    a: 1
  }
  const f2 = {
    b: 2
  }
  const source = new Map([[f1, f2]])

  export function reactive<T extends AnyObject, O extends ReactiveOptions>(source: T, options?: O): ReactiveObject<T, O> {
    const proxy = new Proxy<T>(source, {
      get(target, p, receiver) {
        if (p === sourceObj) {
          return target
        }
        track(target, p)

        const value = Reflect.get(target, p, receiver)

        // # 如果只是浅响应-那就只响应一层，否则套一层再返回
        if (!options?.isShallow && isObject(value)) {
          // # 返回包装对象，不燃深响应毫无意义
          return reactive(value, options)
        }

        if (Array.isArray(target) && typeof p === 'string' && ArrayInterceptorFields.includes(p)) {
          return Reflect.get(ArrayInterceptorHandler, p, receiver)
        }

        if (getType(target) === 'map' && typeof p === 'string' && MapInterceptorFields.includes(p)) {
          return Reflect.get(MapInterceptorHandler, p, receiver)
        }

        return value
      },
      set(target, p, value, receiver) {
        if (options?.isReadonly) return false

        const result = Reflect.set(target, p, value, receiver)

        if (p === 'length') trigger(target, p, value)
        else trigger(target, p)

        return result
      },
    })
    return proxy
  }

  function track(target: AnyObject, p: keyof any) {
    let bucket = Buckets.get(target)
    if (!bucket) bucket = Buckets.set(target, new Map).get(target)!
    let keyList = bucket.get(p)
    if (!keyList) keyList = bucket.set(p, new Set).get(p)!
    activeEffect && keyList.add(activeEffect)
  }

  function trigger(target: AnyObject, p: keyof any, newValue?) {
    const bucket = Buckets.get(target)

    if (!bucket) return
    let callbackList = bucket.get(p) ?? new Set

    if (Array.isArray(target) && p === 'length') {
      bucket.forEach((value, key) => {
        if (typeof key === 'symbol') return
        if (key >= newValue) value.forEach(cb => cb && callbackList.add(cb))
      })
    }

    if (getType(target) === 'map' && p === CurrentSetType['SET']) {
      bucket.get('set')?.forEach(cb => cb && callbackList.add(cb))
    }

    callbackList.forEach(cb => cb())
  }

  function isObject(v) {
    return typeof v === 'object' && v !== null
  }

  function wrap(v) {
    return isObject(v) ? reactive(v) : v
  }

  export function effect(callback: Function) {
    activeEffect = callback
    callback()
    activeEffect = null
  }

  const r1 = reactive(source)

  effect(() => {
    r1.forEach((v, k, t) => {
      console.log(v)
      console.log(k)
    })
  })

  r1.set(f1, {
    b: 0xff
  })
}



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
