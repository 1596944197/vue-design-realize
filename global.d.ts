/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {AnyObject}
 */
declare type AnyObject = {
  [P in keyof any]: any;
} & Object;

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {RenderType}
 * @template T extends AnyObject = AnyObject
 */
declare type RenderType<T extends RenderType = AnyObject> = {
  type: string;
  children: RenderType[] | string;
  props?: {
    [P in keyof T]: T[P];
  };
  render?(): RenderType;
};

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {EffectOptions}
 * @template T = ActiveEffectType
 */
declare type EffectOptions<T = ActiveEffectType> = Partial<{
  scheduler(effectHandler: T): ReturnType<T>;
  lazy: boolean;
}>;

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {ActiveEffectType}
 */
declare type ActiveEffectType = {
  (): void;
  deps: Set<Function>[];
  options?: EffectOptions;
};

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {EffectFunc}
 */
declare type EffectFunc = () => any;

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {WatchOptions}
 */
declare type WatchOptions = Partial<{
  immediate: boolean;
  flush: "post" | "sync";
}>;

/**
 * Description placeholder
 * @date 2023/1/21 - 10:21:16
 *
 * @typedef {WatchCallback}
 */
declare type WatchCallback = (newVal, oldVal, onInvalidate: Function) => any;

/**
 * Description placeholder
 * @date 2023/1/24 - 10:58:00
 *
 * @typedef {ReactiveOptions}
 */
declare type ReactiveOptions = Partial<{
  isShallow: boolean;
  isReadonly: boolean;
}>;

/**
 * Description placeholder
 * @date 2023/1/24 - 10:58:00
 *
 * @typedef {ReactiveObject}
 * @template S extends AnyObject
 * @template O extends ReactiveOptions
 */
declare type ReactiveObject<
  S extends AnyObject,
  O extends ReactiveOptions
  > = O["isReadonly"] extends true
  ? O["isShallow"] extends true
  ? {
    readonly [P in keyof S]: S[P]; // # 浅只读
  } & AnyObject
  : O["isReadonly"] extends true
  ? {
    readonly [P in keyof S]: ReactiveObject<S[P], O>;
  } & AnyObject
  : S & AnyObject
  : S & AnyObject;

declare type ToProxyRefsType<T extends AnyObject> = {
  [K in keyof T]: T[K] | T[K]["value"];
};

declare type RenderContainer = AnyObject & { _vNode?};

declare type AnyArr = any[];

declare type CreateRenderOptions<T extends AnyObject = AnyObject> = Partial<{
  createElement(tag: string): any;
  // 用于设置元素的文本节点
  setElementText(el: T, text): void;
  // 用于在给定的 parent 下添加指定元素
  insert(el: T, parent: T, anchor?): void;
  patchProps(el: T, key, oldProps, newProps): void;
}>;
