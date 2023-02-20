/**
 * # 渲染器
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function renderer(vNode: RenderType, container: HTMLElement) {
  if (typeof vNode.tag === "string") mountElement(vNode, container);
  else mountComponent(vNode, container);
}

/**
 * Description placeholder
 * @date 2023/1/21 - 10:12:48
 *
 * @param {unknown} tag
 * @returns {tag is () => RenderType}
 */
function isFunc(tag: unknown): tag is () => RenderType {
  return typeof tag === "function";
}

/**
 * # 渲染实体元素
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function mountElement(vNode: RenderType, container: HTMLElement) {
  // 使用 vNode.tag 作为标签名称创建 DOM 元素
  const el = document.createElement(vNode.tag as string);
  // 遍历 vNode.props，将属性、事件添加到 DOM 元素
  for (const key in vNode.props) {
    if (/^on/.test(key)) {
      // 如果 key 以 on 开头，说明它是事件
      el.addEventListener(
        key.substring(2).toLowerCase(), // 事件名称 onClick ---> click
        vNode.props[key] // 事件处理函数
      );
    }
  }

  // 处理 children
  if (typeof vNode.children === "string") {
    // 如果 children 是字符串，说明它是元素的文本子节点
    el.appendChild(document.createTextNode(vNode.children));
  } else if (Array.isArray(vNode.children)) {
    // 递归地调用 renderer 函数渲染子节点，使用当前元素 el 作为挂载点
    vNode.children.forEach((child) => renderer(child, el));
  }

  // 将元素添加到挂载点下
  container.appendChild(el);
}

/**
 * # 渲染组件
 * @date 2023/1/21 - 10:12:48
 *
 * @param {RenderType} vNode
 * @param {HTMLElement} container
 */
function mountComponent(vNode: RenderType, container: HTMLElement) {
  if (isFunc(vNode.tag)) {
    const subTree = vNode.tag();

    renderer(subTree, container);
  } else if (isFunc(vNode.render)) {
    const subTree = vNode.render();

    renderer(subTree, container);
  }
}

renderer(
  {
    tag: "div",
    children: [
      { tag: "span", children: "hello world" },
      {
        tag: "h2",
        props: {
          onClick(...ev) {
            alert(2123);
          },
        },
        children: [{ tag: "span", children: "测试" }],
      },
    ],
  },
  document.body
);
