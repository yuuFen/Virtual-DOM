const vnodeType = {
  HTML: 'HTML',
  TEXT: 'TEXT',
  COMPONENT: 'COMPONENT',
  CLASS_COMPONENT: 'CLASS_COMPONENT',
}

const childrenType = {
  EMPTY: 'EMPTY',
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
}

// 新建
function createElement(tag, data, children) {
  let flag
  if (typeof tag == 'string') {
    // 普通的 html 标签
    flag = vnodeType.HTML
  } else if (typeof tag == 'function') {
    flag = vnodeType.COMPONENT
  } else {
    flag = vnodeType.TEXT
  }

  let childrenFlag
  if (children == null) {
    childrenFlag = childrenType.EMPTY
  } else if (Array.isArray(children)) {
    const length = children.length
    if (length === 0) {
      childrenFlag = childrenType.SINGLE
    } else {
      childrenFlag = childrenType.MULTIPLE
    }
  } else {
    // 其他情况认为是文本
    childrenFlag = childrenType.SINGLE
    children = createTextVNode(children + '')
  }

  // 返回 vnode
  return {
    flag, // vnode 类型
    tag, // 标签类型 / 文本没有 tag / 组件的 tag 是函数
    data,
    children,
    childrenFlag,
    el: null,
  }
}

// 渲染
// 要渲染的 vnode、容器（父元素）
function render(vnode, container) {
  // 区分首次渲染和再次渲染
  if (container.vnode) {
    // 更新
    patch(container.vnode, vnode, container)
  } else {
    // 首次渲染
    mount(vnode, container)
  }

  container.vnode = vnode
}

// 挂载元素
function mount(vnode, container) {
  const { flag } = vnode
  if (flag == vnodeType.HTML) {
    // (应该使用对象实现，不然依赖有点乱)
    mountElement(vnode, container)
  } else if (flag == vnodeType.TEXT) {
    mountText(vnode, container)
  }
}

function createTextVNode(text) {
  return {
    flag: vnodeType.TEXT,
    tag: null,
    data: null,
    children: text,
    childrenFlag: childrenType.EMPTY,
  }
}

function mountElement(vnode, container) {
  const dom = document.createElement(vnode.tag)
  vnode.el = dom
  const { data, children, childrenFlag } = vnode

  // 挂载 key
  if (data) {
    for (let key in data) {
      patchData(dom, key, null, data[key])
    }
  }

  if (childrenFlag !== childrenType.EMPTY) {
    if (childrenFlag == childrenType.SINGLE) {
      mount(children, dom)
    } else if (childrenFlag == childrenType.MULTIPLE) {
      for (let i = 0; i < children.length; i++) {
        mount(children[i], dom)
      }
    }
  }

  container.appendChild(dom)
}

function mountText(vnode, container) {
  const dom = document.createTextNode(vnode.children)
  vnode.el = dom
  container.appendChild(dom)
}

