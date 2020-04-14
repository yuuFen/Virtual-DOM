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
      childrenFlag = childrenType.EMPTY
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
    key: data && data.key,
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
function mount(vnode, container, flagNode) {
  const { flag } = vnode
  if (flag == vnodeType.HTML) {
    // (应该使用对象实现，不然依赖有点乱)
    mountElement(vnode, container, flagNode)
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

function mountElement(vnode, container, flagNode) {
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

  flagNode ? container.insertBefore(dom, flagNode) : container.appendChild(dom)
}

function mountText(vnode, container) {
  const dom = document.createTextNode(vnode.children)
  vnode.el = dom
  container.appendChild(dom)
}

// patch
function patch(prev, next, container) {
  const nextFlag = next.flag
  const prevFlag = prev.flag

  // 如 element 变为 text, 直接替换, 不管 children
  if (nextFlag !== prevFlag) {
    replaceVNode(prev, next, container)
  } else if (nextFlag == vnodeType.HTML) {
    patchElement(prev, next, container)
  } else if (nextFlag == vnodeType.TEXT) {
    patchText(prev, next, container)
  }
}

function patchElement(prev, next, container) {
  if (prev.tag !== next.tag) {
    replaceVNode(prev, next, container)
    return
  }
  const el = (next.el = prev.el)

  // patch data
  const prevData = prev.data
  const nextData = next.data
  if (nextData) {
    for (const key in nextData) {
      const prevVal = prevData[key]
      const nextVal = nextData[key]
      patchData(el, key, prevVal, nextVal)
    }
  }
  if (prevData) {
    for (const key in prevData) {
      const prevVal = prevData[key]
      if (prevVal && !nextData.hasOwnProperty(key)) {
        patchData(el, key, prevVal, null)
      }
    }
  }

  // patch children
  patchChildren(prev.childrenFlag, next.childrenFlag, prev.children, next.children, el)
}

function patchChildren(prevChildrenFlag, nextChildrenFlag, prevChildren, nextChildren, container) {
  // 1. 老的是 单独的 / 空的 / 多个
  // 2. 新的是 单独的 / 空的 / 多个
  switch (prevChildrenFlag) {
    case childrenType.SINGLE:
      switch (nextChildrenFlag) {
        case childrenType.SINGLE:
          patch(prevChildren, nextChildren, container)
          break
        case childrenType.EMPTY:
          container.removeChild(prevChildren.el)
          break
        case childrenType.MULTIPLE:
          container.removeChild(prevChildren.el)
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container)
          }
          break
      }
      break

    case childrenType.EMPTY:
      switch (nextChildrenFlag) {
        case childrenType.SINGLE:
          mount(nextChildren, container)
          break
        case childrenType.EMPTY:
          break
        case childrenType.MULTIPLE:
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container)
          }
          break
      }
      break

    case childrenType.MULTIPLE:
      switch (nextChildrenFlag) {
        case childrenType.SINGLE:
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el)
          }
          mount(nextChildren, container)
          break
        case childrenType.EMPTY:
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el)
          }
          break
        case childrenType.MULTIPLE:
          // 众多虚拟 DOM 就在这里产生分歧，每家的优化策略不一样
          // 老：[abc] 新：[c**a**b**]
          // ab 不需要更改，只需要在 ab 之间或之前插入元素，或在最后新建元素
          let lastIndex = 0
          for (let i = 0; i < nextChildren.length; i++) {
            let find = false
            const nextVNode = nextChildren[i]
            for (let j = 0; j < prevChildren.length; j++) {
              const prevVNode = prevChildren[j]
              if (prevVNode.key === nextVNode.key) {
                find = true
                // 如果 key 相同，认为是同一个元素，补丁一下，不新建或销毁
                patch(prevVNode, nextVNode, container)
                if (j < lastIndex) {
                  // 需要移动的情况
                  // lastIndex 指的是上一个找到的元素在 prevVNode 中的位置
                  // j 就是最新找到的元素在 prevVNode 中的位置
                  // 使用 insertBefore 移动元素
                  const flagNode = nextChildren[i - 1].el.nextSibling
                  container.insertBefore(prevVNode.el, flagNode)
                } else {
                  // 如果顺序正确，就更新末尾位置
                  lastIndex = j
                }
              }
            }
            if (!find) {
              // 需要新增
              const flagNode = i == 0 ? prevChildren[0].el : nextChildren[i - 1].el.nextSibling
              mount(nextVNode, container, flagNode)
            }
          }

          // 移除不需要的元素
          for (let i = 0; i < prevChildren.length; i++) {
            const prevVNode = prevChildren[i]
            const has = nextChildren.find((next) => next.key === prevVNode.key)
            if (!has) {
              container.removeChild(prevVNode.el)
            }
          }
          break
      }
      break
  }
}

function patchText(prev, next, container) {
  const el = (next.el = prev.el)
  if (next.children !== prev.children) {
    el.nodeValue = next.children
  }
}

function patchData(el, key, prev, next) {
  switch (key) {
    case 'style':
      for (let key in next) {
        el.style[key] = next[key]
      }
      for (let key in prev) {
        if (!next || !next.hasOwnProperty(key)) {
          el.style[key] = ''
        }
      }

      break
    case 'class':
      el.className = next
      break
    default:
      if (key[0] === '@') {
        if (prev) {
          el.removeEventListener(key.slice(1), prev)
        }
        if (next) {
          el.addEventListener(key.slice(1), next)
        }
      } else {
        el.setAttribute(key, next)
      }
      break
  }
}

function replaceVNode(prev, next, container) {
  container.removeChild(prev.el)
  mount(next, container)
}
