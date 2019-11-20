import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface SkysparkOptions extends DataSourceJsonData {
  timeInterval: string;
  httpMode: string;
  authenticationType: string;
}

export interface SkysparkSecureJsonData {
  password?: string;
}

export interface SkysparkQueryPart {
  type: string;
  params?: string[];
  interval?: string;
}

export interface SkysparkQueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}

export interface SkysparkQuery extends DataQuery {
  policy?: string;
  measurement?: string;
  resultFormat?: 'time_series' | 'table';
  orderByTime?: string;
  tags?: SkysparkQueryTag[];
  groupBy?: SkysparkQueryPart[];
  select?: SkysparkQueryPart[][];
  limit?: string;
  slimit?: string;
  tz?: string;
  fill?: string;
  rawQuery?: boolean;
  query?: string;
}
