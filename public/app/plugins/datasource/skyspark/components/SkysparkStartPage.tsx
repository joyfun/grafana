import React, { PureComponent } from 'react';
import { ExploreStartPageProps } from '@grafana/data';
import SkysparkCheatSheet from './SkysparkCheatSheet';

export default class SkysparkStartPage extends PureComponent<ExploreStartPageProps> {
  render() {
    return <SkysparkCheatSheet onClickExample={this.props.onClickExample} />;
  }
}
