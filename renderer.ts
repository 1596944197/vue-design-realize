namespace Renderer {
  /**
   * 
   * @param options 
   * @description 渲染器的目的之一是为了跨平台，所以需要提供一些平台相关的 API
   */
  function createRenderer(options: CreateRenderOptions) {
    const { createElement, insert, setElementText, patchProps } = options;

    function mountElement(vNode: RenderType, container: HTMLElement) {
      if (!(createElement && insert && setElementText)) return;
      // # 创建 DOM 元素
      const el = createElement(vNode.type);
      // # 将 DOM 元素挂载到 vnode 上
      // # 处理子节点，如果子节点是字符串，代表元素具有文本节点
      if (typeof vNode.children === "string") {
        setElementText(el, vNode.children);
      }
      if (vNode.props) {
        // # Dom Attributes与Html Attributes
        for (const key in vNode.props) {
          const value = vNode.props[key];
          patchProps && patchProps(el, key, el[key], value);
        }
      }
      if (Array.isArray(vNode.children) && vNode.children.length > 0) {
        // # 如果子节点是数组，代表元素具有多个子节点
        vNode.children.forEach((child) => {
          patch(null, child, el);
        });
      }

      insert(el, container);
    }

    function render(vNode: RenderType, container: RenderContainer) {
      if (vNode) {
        // # 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行打补丁
        patch(container._vNode, vNode, container);
      } else {
        if (container._vNode) {
          container.innerHTML = "";
        }
      }
      container._vNode = vNode;
    }

    function patch(oldNode, newNode, container) {
      if (!oldNode) {
        // # 如果 n1 不存在，意味着挂载，则调用 mountElement 函数完成挂载
        mountElement(newNode, container);
      }
      else if (!newNode) {
        // # 如果 n2 不存在，意味着卸载，则调用 container.removeChild 完成卸载
        container.removeChild(oldNode.el);
      }
    }

    return {
      render,
    };
  }

  const vn: RenderType = {
    type: "h1",
    props: {
      id: "title",
      class: 'test',
      onclick: () => {
        console.log('click');
      }
    },
    children: [
      {
        type: "span",
        children: "hello",
      },
      {
        type: "input",
        props: {
          disabled: ''
        },
        children: ",world",
      }
    ],
  };
  const r = createRenderer({
    createElement(tag) {
      return document.createElement(tag);
    },
    setElementText(el, text) {
      el.textContent = text;
    },
    insert(el, parent, anchor) {
      parent.insertBefore(el, anchor);
    },
    patchProps(el, key, oldProps, newProps) {
      if (key === 'disabled') {
        el[key] = ['', true].includes(newProps) ? true : ''
      }
      el[key] = newProps;
    },
  });
  // # 首次渲染
  r.render(vn, document.body);
}
