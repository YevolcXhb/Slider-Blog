/**
 * Slider 风格顶部进度条
 * 通过 #progress-bar + .loading/.finishing/.done 类控制
 * 配合 usePageTransition 钩子在页面切换时触发动画
 */
export function ProgressBar() {
  return <div id="progress-bar" aria-hidden="true" />
}
