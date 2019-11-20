import SkysparkDatasource from './datasource';
import { SkysparkQueryCtrl } from './query_ctrl';
import { SkysparkLogsQueryField } from './components/SkysparkLogsQueryField';
import SkysparkStartPage from './components/SkysparkStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';

class SkysparkAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(SkysparkDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(SkysparkQueryCtrl)
  .setAnnotationQueryCtrl(SkysparkAnnotationsQueryCtrl)
  .setExploreLogsQueryField(SkysparkLogsQueryField)
  .setExploreStartPage(SkysparkStartPage);
