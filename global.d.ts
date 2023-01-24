/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {AnyObject}
 */
declare type AnyObject = {
  [P in keyof any]: any
} & Object

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {RenderType}
 * @template T extends AnyObject = AnyObject
 */
declare type RenderType<T extends AnyObject = AnyObject> = {
  tag: string | (() => RenderType),
  children: RenderType[] | string
  props?: {
    [P in keyof T]: T[P]
  },
  render?(): RenderType
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {EffectOptions}
 * @template T = ActiveEffectType
 */
declare type EffectOptions<T = ActiveEffectType> = Partial<{
  scheduler(effectHandler: T): ReturnType<T>;
  lazy: boolean
}>

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {ActiveEffectType}
 */
declare type ActiveEffectType = { (): void; deps: Set<Function>[], options?: EffectOptions }

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {EffectFunc}
 */
declare type EffectFunc = () => any

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {WatchOptions}
 */
declare type WatchOptions = Partial<{
  immediate: boolean
  flush: 'post' | 'sync'
}>

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {WatchCallback}
 */
declare type WatchCallback = (newVal, oldVal, onInvalidate: Function) => any

declare type ReactiveOptions = Partial<{
  isShallow: boolean
  isReadonly: boolean
}>

declare type ReactiveObject<S extends AnyObject, O extends ReactiveOptions> =
  O['isReadonly'] extends true ? O['isShallow'] extends true ?
  {
    readonly [P in keyof S]: S[P] // # 浅只读
  } & AnyObject :
  O['isReadonly'] extends true ? {
    readonly [P in keyof S]: ReactiveObject<S[P], O>
  } & AnyObject :
  S & AnyObject :
  S & AnyObject