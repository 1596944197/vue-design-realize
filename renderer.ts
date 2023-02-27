namespace Renderer {
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
      vNode.children.forEach((child) => render(child, el));
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

      render(subTree, container);
    } else if (isFunc(vNode.render)) {
      const subTree = vNode.render();

      render(subTree, container);
    }
  }

  /**
   * ### 渲染函数
   * @date 2/20/2023 - 5:07:33 PM
   *
   * @param {RenderType} vNode
   * @param {RenderContainer} container
   */
  function render(vNode: RenderType, container: RenderContainer) {
    if (vNode) {
      // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行打补丁
      patch(container._vNode, vNode, container);
    } else {
      if (container._vNode) {
        container.innerHTML = "";
      }
    }
    container._vNode = vNode;

    if (typeof vNode.tag === "string") mountElement(vNode, container);
    else mountComponent(vNode, container);
  }

  function patch(...args) {}

  function createRenderer() {
    return {
      render,
    };
  }

  const vn = {
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
  };
  const r = createRenderer();
  // # 首次渲染
  r.render(vn, document.body);
}
