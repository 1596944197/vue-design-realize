namespace Renderer {
  function isFunc(tag: unknown): tag is () => RenderType {
    return typeof tag === "function";
  }

  function createRenderer(options: CreateRenderOptions) {
    const { createElement, insert, setElementText } = options;

    function mountElement(vNode: RenderType, container: HTMLElement) {
      if (!(createElement && insert && setElementText)) return;
      // 创建 DOM 元素
      const el = createElement(vNode.tag);
      // 处理子节点，如果子节点是字符串，代表元素具有文本节点
      if (typeof vNode.children === "string") {
        setElementText(el, vNode.children);
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
      } else {
      }
    }

    return {
      render,
    };
  }

  const vn: RenderType = {
    tag: "h1",
    children: "测试数据",
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
  });
  // # 首次渲染
  r.render(vn, document.body);

  const r2 = createRenderer({
    createElement(tag) {
      console.log(`元素是${tag}`);
      return { tag };
    },
    setElementText(el, text) {
      console.log(`设置 ${JSON.stringify(el)} 的文本内容：${text}`);
      el.textContent = text;
    },
    insert(el, parent, anchor) {
      console.log(
        `将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`
      );
      parent.children = el;
    },
  });

  const c = { a: 1 };
  const v2 = {
    tag: "view",
    children: "内容",
  };
  r2.render(v2, c);
}
