type RenderType<T extends AnyObject = AnyObject> = {
  tag: string | (() => RenderType),
  children: RenderType[] | string
  props?: {
    [P in keyof T]: T[P]
  },
  render?(): RenderType
}

// # 渲染器
function renderer(vNode: RenderType, container: HTMLElement) {
  if (typeof vNode.tag === 'string') mountElement(vNode, container)

  else mountComponent(vNode, container)
}

function isFunc(tag: unknown): tag is () => RenderType {
  return typeof tag === 'function'
}

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


let activeEffect: { (): void; deps: Set<Function>[]; }

const source = {
  a: 'abcd',
  ok: true,
  text: 'hello world'
}
const bucket = new WeakMap<Object, Map<string | symbol, Set<Function>>>()

const obj = new Proxy<typeof source & { [P in keyof any]: any }>(source, {
  get(target, p) {
    track(target, p)

    return Reflect.get(target, p)
  },
  set(target, p, value) {
    Reflect.set(target, p, value)

    trigger(target, p)

    return true
  },
})

function track(target, p) {
  // # 没有 activeEffect，直接 return

  if (!activeEffect) return Reflect.get(target, p)

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

function trigger(target, p) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const deps = new Set(depsMap.get(p))

  deps.forEach(func => func())

  /**
   * # 在调用 forEach 遍历 Set 集合时，如果一个值已经被访问过了，
   * # 但该值被删除并重新添加到集合，如果此时 forEach 遍历没有结束，
   * # 那么该值会重新被访问。因此，上面的代码会无限执行。
   * # 根据书上解决方法之一是用set再包裹一层
   */
  // const deps = depsMap.get(p)
  // deps && deps.forEach(func => func())
}

function effect(func: Function) {
  const effectHandler = () => {
    cleanup(effectHandler)
    activeEffect = effectHandler
    func()
  }

  effectHandler.deps = []

  effectHandler()
}

function cleanup(effectHandler: typeof activeEffect) {
  if (!effectHandler.deps) return
  effectHandler.deps.forEach(dep => dep.delete(effectHandler))

  effectHandler.deps.length = 0
}

effect(() => {
  console.log(123123)
  document.body.innerHTML = `<h2>${obj.ok ? obj.text : 'nothing'}</h2>`
})
