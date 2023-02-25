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
  // ! 常量end

  const source = {
    a: 1,
    b: true,
    c: {
      d: 2
    },
  }

  export function reactive<T extends AnyObject, O extends ReactiveOptions>(source: T, options?: O) {
    const proxy = new Proxy<T>(source, {
      get(target, p, receiver) {
        track(target, p)

        // # 如果只是浅响应-那就只响应一层，否则递归处理
        if (!options?.isShallow && typeof p === 'string' && isObject(target[p])) {
          reactive(target[p], options)
        }

        return Reflect.get(target, p, receiver)
      },
      set(target, p, value, receiver) {
        const result = Reflect.set(target, p, value, receiver)

        trigger(target, p)

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

  function trigger(target: AnyObject, p: keyof any) {
    const bucket = Buckets.get(target)

    if (!bucket) return
    const callbackList = bucket.get(p)!

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
    console.log(r1.c.d)
  })
  r1.c.d = 0x15
}