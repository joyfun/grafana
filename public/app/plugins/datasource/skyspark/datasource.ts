import _ from 'lodash';

import SkysparkSeries from './skyspark_series';
import SkysparkQueryModel from './skyspark_query_model';

import { dateMath, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import ResponseParser from './response_parser';
import { SkysparkQueryBuilder } from './query_builder';
import { SkysparkQuery, SkysparkOptions } from './types';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

export default class SkysparkDatasource extends DataSourceApi<SkysparkQuery, SkysparkOptions> {
  type: string;
  urls: any;
  username: string;
  password: string;
  name: string;
  database: any;
  basicAuth: any;
  withCredentials: any;
  interval: any;
  responseParser: any;
  httpMode: string;
  skyTimes: any;
  authenticationType: string;

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings<SkysparkOptions>, private templateSrv: TemplateSrv) {
    super(instanceSettings);
    this.skyTimes = { d: 'day', m: 'mo', w: 'week', y: 'yr' };
    this.type = 'skyspark';
    this.urls = _.map(instanceSettings.url.split(','), url => {
      return url.trim();
    });

    this.username = instanceSettings.username;
    this.password = instanceSettings.password;
    this.name = instanceSettings.name;
    this.database = instanceSettings.database;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    // this authenticationType = instanceSettings.jsonData.authenticationType;

    const settingsData = instanceSettings.jsonData || ({} as SkysparkOptions);
    this.interval = settingsData.timeInterval;
    this.httpMode = settingsData.httpMode || 'GET';
    this.responseParser = new ResponseParser();
    this.authenticationType = settingsData.authenticationType;
  }

  query(options: any) {
    let timeFilter = this.getTimeFilter(options);
    const scopedVars = options.scopedVars;
    const targets = _.cloneDeep(options.targets);
    const queryTargets: any[] = [];
    let queryModel: SkysparkQueryModel;
    let y;

    let allQueries = _.map(targets, target => {
      if (target.hide) {
        return '';
      }

      queryTargets.push(target);

      // backward compatibility
      scopedVars.interval = scopedVars.__interval;

      queryModel = new SkysparkQueryModel(target, this.templateSrv, scopedVars);
      return queryModel.render(true);
    }).reduce((acc, current) => {
      if (current !== '') {
        acc += ';' + current;
      }
      return acc;
    });

    if (allQueries === '') {
      return Promise.resolve({ data: [] });
    }

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    if (adhocFilters.length > 0) {
      timeFilter += ' AND ' + queryModel.renderAdhocFilters(adhocFilters);
    }

    // replace grafana variables
    scopedVars.timeFilter = { value: timeFilter };

    // replace templated variables
    allQueries = this.templateSrv.replace(allQueries, scopedVars);

    return this._seriesQuery(allQueries, options).then((data: any): any => {
      console.log(data);
      if (!data || !data.cols) {
        return [];
      }

      const seriesList = [];

      const target = data.meta.equipName;
      const alias = data.meta.equipName;
      const series: any = {};
      const colnames: string[] = [];
      const coldis: string[] = [];
      data.cols.forEach((cl: any, index: any) => {
        // if ((data.meta.chartType === 'donut' || data.meta.chartType === 'pie') && cl['name'] === 'ts') {
        // } else {
        colnames.push(cl['name']);
        let dis = cl['name'];
        if (cl['dis']) {
          dis = cl['dis'];
        }
        coldis.push(dis);
        // }
      });
      const nseries = data.rows.map((p: any) => {
        const rst: any[] = [];
        for (const idx in colnames) {
          let val = this.responseParser.parseVal(p[colnames[idx]]);
          if (data.meta.chartType === 'donut') {
            val = parseFloat(val);
          }
          rst.push(val);
        }
        return rst;
      });
      series.name = target;
      series.columns = coldis;
      series.values = nseries;
      const skysparkSeries = new SkysparkSeries({
        series: series,
        alias: alias,
      });

      switch (target) {
        case 'table': {
          seriesList.push(skysparkSeries.getTable());
          break;
        }
        default: {
          const timeSeries = skysparkSeries.getTimeSeries();
          for (y = 0; y < timeSeries.length; y++) {
            seriesList.push(timeSeries[y]);
          }
          break;
        }
      }

      return { data: seriesList };
    });
  }

  annotationQuery(options: any) {
    if (!options.annotation.query) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw, timezone: options.timezone });
    let query = options.annotation.query.replace('$timeFilter', timeFilter);
    query = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(query, options).then((data: any) => {
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from SkysparkDB' };
      }
      return new SkysparkSeries({
        series: data.results[0].series,
        annotation: options.annotation,
      }).getAnnotations();
    });
  }

  targetContainsTemplate(target: any) {
    for (const group of target.groupBy) {
      for (const param of group.params) {
        if (this.templateSrv.variableExists(param)) {
          return true;
        }
      }
    }

    for (const i in target.tags) {
      if (this.templateSrv.variableExists(target.tags[i].value)) {
        return true;
      }
    }

    return false;
  }

  interpolateVariablesInQueries(queries: SkysparkQuery[]): SkysparkQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          measurement: this.templateSrv.replace(query.measurement, null, 'regex'),
        };

        if (query.rawQuery) {
          expandedQuery.query = this.templateSrv.replace(query.query, null, 'regex');
        }

        if (query.tags) {
          const expandedTags = query.tags.map(tag => {
            const expandedTag = {
              ...tag,
              value: this.templateSrv.replace(tag.value, null, 'regex'),
            };
            return expandedTag;
          });
          expandedQuery.tags = expandedTags;
        }
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  metricFindQuery(query: string, options?: any) {
    const interpolated = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(interpolated, options).then(resp => {
      return this.responseParser.parse(query, resp);
    });
  }

  getTagKeys(options: any = {}) {
    const queryBuilder = new SkysparkQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_KEYS');
    return this.metricFindQuery(query, options);
  }

  getTagValues(options: any = {}) {
    const queryBuilder = new SkysparkQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
    return this.metricFindQuery(query, options);
  }

  _seriesQuery(query: string, options?: any) {
    if (!query) {
      return Promise.resolve({ results: [] });
    }

    if (options && options.range) {
      const timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
      query = query.replace('$timeFilter', timeFilter);
    }

    return this._skysparkRequest(this.httpMode, '/eval', { q: query, epoch: 'ms' }, options);
  }

  serializeParams(params: any) {
    if (!params || !params['q']) {
      return '';
    }

    return 'ver:"3.0"\nexpr\n"' + params['q'] + '"';
  }

  testDatasource() {
    const queryBuilder = new SkysparkQueryBuilder({ measurement: '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('RETENTION POLICIES');

    return this._seriesQuery(query)
      .then((res: any) => {
        const error = _.get(res, 'results[0].error');
        if (error) {
          return { status: 'error', message: error };
        }
        return { status: 'success', message: 'Data source is working' };
      })
      .catch((err: any) => {
        return { status: 'error', message: err.message };
      });
  }

  _skysparkRequest(method: string, url: string, data: any, options?: any) {
    const currentUrl = this.urls.shift();
    this.urls.push(currentUrl);

    const params: any = {};

    if (this.username) {
      params.u = this.username;
      params.p = this.password;
    }

    if (options && options.database) {
      params.db = options.database;
    } else if (this.database) {
      params.db = this.database;
    }

    if (method === 'POST' && _.has(data, 'q')) {
      // verb is POST and 'q' param is defined
      _.extend(params, _.omit(data, ['q']));
      data = this.serializeParams(_.pick(data, ['q']));
    } else if (method === 'GET' || method === 'POST') {
      // verb is GET, or POST without 'q' param
      _.extend(params, data);
      data = null;
    }

    const req: any = {
      method: method,
      url: currentUrl + url,
      params: params,
      data: data,
      // data: 'ver:\"3.0\"\nexpr\n\"site\"',
      precision: 'ms',
      inspect: { type: 'skyspark' },
      paramSerializer: this.serializeParams,
    };

    req.headers = req.headers || {};
    if (this.basicAuth || this.withCredentials) {
      req.withCredentials = true;
    }
    if (this.basicAuth) {
      req.headers.Authorization = this.basicAuth;
    }

    if (method === 'POST') {
      req.headers['Content-Type'] = 'text/zinc; charset=UTF-8';
      req.headers['Accept'] = 'application/json';
    }

    return getBackendSrv()
      .datasourceRequest(req)
      .then(
        (result: any) => {
          return result.data;
        },
        (err: any) => {
          if ((Number.isInteger(err.status) && err.status !== 0) || err.status >= 300) {
            if (err.data && err.data.error) {
              throw {
                message: 'InfluxDB Error: ' + err.data.error,
                data: err.data,
                config: err.config,
              };
            } else {
              throw {
                message: 'Network Error: ' + err.statusText + '(' + err.status + ')',
                data: err.data,
                config: err.config,
              };
            }
          } else {
            throw err;
          }
        }
      );
  }

  getTimeFilter(options: any) {
    const from = this.getSkysparkTime(options.rangeRaw.from, false, options.timezone);
    const until = this.getSkysparkTime(options.rangeRaw.to, true, options.timezone);
    // const fromIsAbsolute = from[from.length - 1] === 'ms';
    // console.log(fromIsAbsolute);
    // console.log(from);
    // console.log(until);
    return from + '..' + until;
  }

  getSkysparkTime(date: any, roundUp: any, timezone: any) {
    if (_.isString(date)) {
      if (date === 'now') {
        return 'now()';
      }

      const parts = /^now-(\d+)([dhms])$/.exec(date);
      if (parts) {
        const amount = parseInt(parts[1], 10);
        const unit = parts[2];
        return 'now() - ' + amount + this.skyTimes[unit];
      }
      date = dateMath.parse(date, roundUp, timezone);
    }

    return 'fromJavaMillis(' + date.valueOf() + ')';
  }
}