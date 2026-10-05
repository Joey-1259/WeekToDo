/**
 * 计算只读脑图预览的缩放与根节点目标位置。
 * 坐标以根节点中心为原点，全部是未缩放坐标。
 */
export function planMindMapViewport({
  width,
  height,
  bounds,
  direction = 1,
  single = false,
  padding = 24,
}) {
  if (
    !(width > padding * 2) ||
    !(height > padding * 2) ||
    !bounds ||
    ![bounds.left, bounds.top, bounds.right, bounds.bottom]
      .every(Number.isFinite)
  ) {
    return null;
  }

  const left = Math.max(0, -bounds.left);
  const right = Math.max(0, bounds.right);
  const top = Math.max(0, -bounds.top);
  const bottom = Math.max(0, bounds.bottom);

  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  let spanX = left + right;
  let spanY = top + bottom;

  if (single || direction === 2) {
    spanX = 2 * Math.max(left, right);
    spanY = 2 * Math.max(top, bottom);
  } else if (direction === 3) {
    spanX = 2 * Math.max(left, right);
  } else {
    spanY = 2 * Math.max(top, bottom);
  }

  const scale = Math.min(
    1,
    availableWidth / Math.max(spanX, 1),
    availableHeight / Math.max(spanY, 1)
  );

  let rootX = width / 2;
  let rootY = height / 2;

  if (!single && direction === 1) {
    rootX = padding + left * scale;
  } else if (!single && direction === 0) {
    rootX = width - padding - right * scale;
  } else if (!single && direction === 3) {
    rootY = padding + top * scale;
  }

  return { scale, rootX, rootY };
}
