/// <reference path="./global.d.ts" />

/**
 * ### 用于实现响应式功能-最简demo
 */
export namespace MyReactive {
  // ! 常量start
  /**
   * #### 用于存储响应式对象的键对应的副作用函数
   */
  const Buckets = new Map<AnyObject, Map<keyof any, Set<Function>>>()

  let activeEffect: Function

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
  // ! 常量end

  const f1 = {
    a: 1
  }
  const source = [f1]

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
    keyList.add(activeEffect)
  }

  function trigger(target: AnyObject, p: keyof any, newValue?) {
    const bucket = Buckets.get(target)

    if (!bucket) return
    let callbackList = bucket.get(p) ?? new Set

    if (Array.isArray(target) && p === 'length') {
      bucket.forEach((value, key) => {
        if (typeof key === 'symbol') return
        if (key >= newValue) value.forEach(cb => callbackList.add(cb))
      })
    }

    callbackList.forEach(cb => cb())
  }

  function isObject(v) {
    return typeof v === 'object' && v !== null
  }

  export function effect(callback: Function) {
    activeEffect = callback
    callback()
  }

  const r1 = reactive(source)

  effect(() => {
    console.log(r1.includes(f1))
    console.log(r1.indexOf(f1))
  })
}