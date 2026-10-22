/** 把 photos/xxx.jpg 这类相对路径解析成部署后仍可用的地址（支持 GitHub Pages 子路径） */
export function photoUrl(src?: string): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  try {
    return new URL(src.replace(/^\/+/, ''), document.baseURI).href;
  } catch {
    return src;
  }
}
