export interface Couple {
  /** 男方称呼 */
  boy: string;
  /** 女方称呼 */
  girl: string;
  /** 头像图片地址（可留空，留空显示名字首字） */
  boyAvatar?: string;
  girlAvatar?: string;
  /** 名字下面的一行小字 */
  boyTag?: string;
  girlTag?: string;
  /** 在一起的日子，YYYY-MM-DD */
  startDate: string;
  /** 首页大标题（固定文案时用这个） */
  title: string;
  /**
   * 会随天数变化的标题模板，可用占位符：
   * {days} → 164，{cn} → 一百六十四
   * 填了它就用它，忽略 title
   */
  titleTemplate?: string;
  /** 大标题里高亮的那几个字（用模板时不生效） */
  titleHighlight?: string;
  /** 标题下的一句话 */
  subtitle: string;
  /** 页脚的一句话 */
  motto?: string;
}

export interface Milestone {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  text: string;
  /** 标签，例如「初见」「旅行」 */
  tag?: string;
  /** 图片地址列表：本地相对路径写成 photos/xxx.jpg，云端是完整 URL */
  photos?: string[];
  /** 这条是谁写的：boy = 男方，girl = 女方 */
  author?: 'boy' | 'girl';
}

export interface Anniversary {
  id: string;
  /** YYYY-MM-DD，公历生日/纪念日用；农历纪念日见下面两个字段 */
  date: string;
  title: string;
  /** 卡片上的小图标，直接写一个 emoji */
  icon: string;
  note?: string;
  /** 农历月日，例如「八月初八」；填了就用农历推算 */
  lunar?: string;
  /** 农历对应的阳历日期表，key 是年份，值 YYYY-MM-DD（由 scripts/lunar-table.mjs 生成） */
  solarByYear?: Record<string, string>;
}

export interface GalleryItem {
  id: string;
  src: string;
  caption?: string;
}

export interface SiteData {
  /** 内容版本号：改了 sample.json 里的内容就 +1，否则浏览器里旧的本地数据会盖住新内容 */
  version?: number;
  couple: Couple;
  quotes: string[];
  milestones: Milestone[];
  anniversaries: Anniversary[];
  gallery: GalleryItem[];
}
