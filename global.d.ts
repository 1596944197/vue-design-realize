declare type AnyObject = {
  [P in keyof any]: any
} & Object

declare function track(target: AnyObject, p: string | symbol): void

declare function trigger(target: AnyObject, p: string | symbol): void

declare type RenderType<T extends AnyObject = AnyObject> = {
  tag: string | (() => RenderType),
  children: RenderType[] | string
  props?: {
    [P in keyof T]: T[P]
  },
  render?(): RenderType
}

declare type EffectOptions<T = ActiveEffectType> = Partial<{
  scheduler(effectHandler: T): ReturnType<T>;
  lazy: boolean
}>

declare type ActiveEffectType = { (): void; deps: Set<Function>[], options?: EffectOptions }

declare type EffectFunc = () => any

declare type WatchOptions = Partial<{
  immediate: boolean
  flush: 'post' | 'sync'
}>