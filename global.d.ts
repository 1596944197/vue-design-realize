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
