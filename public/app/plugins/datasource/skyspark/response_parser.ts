import _ from 'lodash';

export default class ResponseParser {
  parseVal(valstr: any) {
    if (valstr === null || valstr === undefined) {
      return null;
    } else if (valstr === true || valstr === false) {
      return valstr;
    } else {
      //console.log(valstr)
      const type = valstr.substring(0, 2);
      const val = valstr.substring(2);

      // if (type==='b:') return HBin.make(val);else
      // if (type==='c:') { let v = val.split(','); return HCoord.make(parseFloat(v[0]), parseFloat(v[1])); }
      //else if (type==='d:') { return HDate.make(val); }
      if (type === 't:') {
        return Date.parse(valstr.substring(2, 27));
      } else if (type === 'n:') {
        const v = val.split(' ');
        if (v[0] === 'INF') {
          v[0] = Number.POSITIVE_INFINITY;
        } else if (v[0] === '-INF') {
          v[0] = Number.NEGATIVE_INFINITY;
        }
        if (v[0] === 'NaN') {
          v[0] = Number.NaN;
        }
        if (v[0] != null) {
          v[0] = parseFloat(v[0]).toFixed(2);
        }
        return v[0];
      } else if (type === 'r:') {
        const v = val.split(' ');
        for (let i = 2; i < v.length; i++) {
          v[1] += ' ' + v[i];
        }
        return v[1];
      } else {
        return valstr;
        //throw new Error("Invalid Type Reference: '" + type + val + "'");
      }
    }
  }
  parse(query: string, results: { results: any }) {
    if (!results || results.results.length === 0) {
      return [];
    }

    const influxResults = results.results[0];
    if (!influxResults.series) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const isValueFirst =
      normalizedQuery.indexOf('show field keys') >= 0 || normalizedQuery.indexOf('show retention policies') >= 0;

    const res = {};
    _.each(influxResults.series, serie => {
      _.each(serie.values, value => {
        if (_.isArray(value)) {
          // In general, there are 2 possible shapes for the returned value.
          // The first one is a two-element array,
          // where the first element is somewhat a metadata value:
          // the tag name for SHOW TAG VALUES queries,
          // the time field for SELECT queries, etc.
          // The second shape is an one-element array,
          // that is containing an immediate value.
          // For example, SHOW FIELD KEYS queries return such shape.
          // Note, pre-0.11 versions return
          // the second shape for SHOW TAG VALUES queries
          // (while the newer versions—first).

          if (isValueFirst) {
            addUnique(res, value[0]);
          } else if (value[1] !== undefined) {
            addUnique(res, value[1]);
          } else {
            addUnique(res, value[0]);
          }
        } else {
          addUnique(res, value);
        }
      });
    });

    // @ts-ignore problems with typings for this _.map only accepts [] but this needs to be object
    return _.map(res, value => {
      // @ts-ignore
      return { text: value.toString() };
    });
  }
}

function addUnique(arr: { [x: string]: any }, value: string | number) {
  arr[value] = value;
}
