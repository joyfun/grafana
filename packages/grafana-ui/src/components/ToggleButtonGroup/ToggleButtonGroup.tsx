import React, { PureComponent } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { ThemeContext } from '../../themes/index';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '../../types/theme';
import tinycolor from 'tinycolor2';
import { ToggleButtonGroupProps, ToggleButtonGroupState, ToggleButtonProps, ToggleButtonState } from './types';
import { increaseContrast } from '../../utils/colors';

export class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps, ToggleButtonGroupState> {
  constructor(props: ToggleButtonGroupProps) {
    super(props);
    this.state = {
      active: props.active || null,
    };
  }

  renderChildren(theme: GrafanaTheme) {
    const styles = getStyles(theme);
    return (
      <>
        {React.Children.map(this.props.children, (child: any, index) => {
          // Set correct style depending on first/middle/last
          const style =
            index === 0 ? styles.first : index === this.props.children.length - 1 ? styles.last : styles.middle;

          return React.cloneElement(child, {
            className: style,
          });
        })}
      </>
    );
  }

  render() {
    return <ThemeContext.Consumer>{theme => this.renderChildren(theme)}</ThemeContext.Consumer>;
  }
}

export class ToggleButton extends PureComponent<ToggleButtonProps, ToggleButtonState> {
  constructor(props: ToggleButtonProps) {
    super(props);
    this.state = {
      untouched: true,
      selected: props.selected,
      value: props.value,
    };

    this.handleBlur = this.handleBlur.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.SyntheticEvent) {
    e.stopPropagation();
    console.log(e);
    this.setState(prevState => ({
      untouched: false,
      selected: !prevState.selected,
    }));
    if (this.props.onChange) {
      this.props.onChange(this.state);
    }
  }

  handleBlur() {
    this.setState({
      untouched: true,
    });
  }

  componentDidUpdate(prevProps: ToggleButtonProps) {
    //Override internal select toggle if props are updated
    if (prevProps.selected !== this.props.selected) {
      this.setState({
        selected: this.props.selected,
      });
    }
  }

  renderButton(theme: GrafanaTheme) {
    const styles = getStyles(theme);
    const { children, className } = this.props;
    const activeStyle = this.state.selected ? styles.active : null;

    return (
      <button
        onBlur={this.handleBlur}
        className={cx([styles.button, activeStyle, className, this.state.untouched ? styles.focus : styles.unFocused])}
        onClick={this.handleClick}
      >
        <span>{children}</span>
      </button>
    );
  }

  render() {
    const { tooltip } = this.props;

    const button = <ThemeContext.Consumer>{theme => this.renderButton(theme)}</ThemeContext.Consumer>;

    if (tooltip) {
      return (
        <Tooltip content={tooltip} placement="bottom">
          {button}
        </Tooltip>
      );
    } else {
      return button;
    }
  }
}

const getStyles = (theme: GrafanaTheme) => {
  const borderRadius = 2;
  const bg = theme.colors.bodyBg;
  const activeBg = increaseContrast(theme.colors.bodyBg, 10);
  const activeText = theme.colors.blueBase;
  return {
    button: css`
      border: solid 1px #c7d0d9;
      color: ${theme.colors.text};
      padding: 0 16px;
      background-color: ${bg};
      border-radius: ${borderRadius}px;
      height: 36px;
      font-size: 14px;
      font-weight: normal;
      /*Make borders overlap*/
      margin-left: -1px;

      /*Position to enable z-index*/
      position: relative;
      z-index: 899;
      &:hover {
        color: ${activeText};
        font-weight: 500;
      }
    `,
    active: css`
      font-weight: 500;
      background-color: ${activeBg};
      color: ${activeText};
      border-color: ${theme.colors.blueBase};
      /*To priorotize blue overlapping border*/
      z-index: 900;
    `,
    focus: css`
      &:focus {
        outline: none;
        z-index: 900;
        font-weight: 500;
        background-color: ${tinycolor.mix(theme.colors.blueShade, activeBg, 90).toString()};
        color: ${activeText};
        border-color: ${theme.colors.blueBase};
      }
    `,
    unFocused: css`
      &:focus {
        outline: none;
      }
    `,
    middle: css`
      border-radius: 0;
    `,
    first: css`
      border-radius: ${borderRadius}px 0 0 ${borderRadius}px;
      margin-left: 0;
    `,
    last: css`
      border-radius: 0 ${borderRadius}px ${borderRadius}px 0;
    `,
  };
};