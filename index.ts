
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



// # 响应式系统内容
let activeEffect: ActiveEffectType
const effectStack: ActiveEffectType[] = []
const source = {
  a: 'abcd',
  ok: true,
  text: 'hello world',
  fff: 2,
  value: 0xff
}
const bucket = new WeakMap<Object, Map<string | symbol, Set<ActiveEffectType>>>()

const f1 = { foo: true, bar: true }

const obj = setProxy(source)

function setProxy<T extends AnyObject>(source: T) {
  return new Proxy<typeof source & { [P in keyof any]: any }>(source, {
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
}

//# 跟踪数据
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

function trigger(target, p) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const deps = new Set(depsMap.get(p))

  // # 当前活动的副作用函数如何与遍历出来的副作用函数相同，则取消执行
  deps.forEach(effectHandler => {
    if (activeEffect === effectHandler) return

    if (effectHandler.options?.scheduler) {
      effectHandler.options.scheduler(effectHandler)
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

function cleanup(effectHandler: ActiveEffectType) {
  if (!effectHandler.deps.length) return
  effectHandler.deps.forEach(dep => dep.delete(effectHandler))

  effectHandler.deps.length = 0
}


//# 定义一个任务队列
const jobQueue = new Set<Function>()

//# 一个标志代表是否正在刷新队列
let isFlushing = false

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

// # 避免不必要的执行
effect(() => {
  document.body.innerHTML = `<h2>${obj.ok ? obj.text : 'nothing'}</h2>`
})

// # 避免嵌套的副作用函数无法正确捕获
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
const res = effect(() => {
  obj.fff++
}, {
  lazy: true
})
res()


// # 简易的computed属性
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

const r = computed(() => obj.fff * obj.fff)

effect(() => {
  r.value
})

obj.fff++

// # 简易的watch函数
function watch<T extends () => any, Cb extends (...args) => any>(source: T, callback: Cb);
function watch<T extends AnyObject, Cb extends (...args) => any>(source: T, callback: Cb);
function watch<T extends AnyObject, Cb extends (...args) => any>(source: T, callback: Cb) {
  // 定义 getter
  let getter: Function
  // 如果 source 是函数，说明用户传递的是 getter，所以直接把 source 赋值给 getter
  if (typeof source === 'function') {
    getter = source
  } else {
    // 否则按照原来的实现调用 traverse 递归地读取
    getter = () => traverse(source)
  }

  let newVal, oldVal

  const result = effect(() => getter(), {
    lazy: true,
    scheduler(effectHandler) {
      newVal = effectHandler()
      callback(newVal, oldVal)
      oldVal = newVal
    },
  })

  oldVal = result()

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



watch(obj, () => {
  console.log('监听对象')
})

watch(() => obj.text, (n, o) => {
  console.log(n, o)
})


obj.text = '2323232424242'