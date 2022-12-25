declare type AnyObject = {
  [P in keyof any]: any
} & Object

declare function track(target: AnyObject, p: string | symbol): void

declare function trigger(target: AnyObject, p: string | symbol): void
