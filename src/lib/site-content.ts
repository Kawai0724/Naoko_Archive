export const siteContentFields={
  aboutIntro:{label:'关于本站介绍',value:'这里以河合奈保子的作品为中心，把唱片资料、印刷物与影像线索放在一起，尝试用中文建立一份清楚、可阅读的数字档案。'},
  contributionGuidelines:{label:'共建说明与规则',value:'欢迎补充唱片版本与编号、旧节目与演出线索、写真出版记录、可信资料来源，以及对现有条目的更正。请尽量附上可核验的出处；图像与音视频资料须注明来源及公开使用授权。'}
};
export type SiteContentKey=keyof typeof siteContentFields;
export const requestStatusLabels={pending:'待审核',approved:'已通过',rejected:'已拒绝'};
export type ContentSnapshot=Record<SiteContentKey,{value:string;revision:number}>;
