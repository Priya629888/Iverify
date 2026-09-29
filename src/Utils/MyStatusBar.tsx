import React from 'react';
import {
  StatusBar,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBarStyle,
} from 'react-native';

import {COLORS} from '../Themes/Themes';
import normalize from './Helpers/normalize';

const STATUSBAR_HEIGHT = StatusBar.currentHeight ?? 0;

interface MyStatusBarProps {
  backgroundColor?: string;
  barStyle?: StatusBarStyle;
  height?: number;
}

const MyStatusBar: React.FC<MyStatusBarProps> = ({
  backgroundColor = COLORS.white,
  barStyle = 'light-content',
}) => {
  return (
    <SafeAreaView
      style={
        Platform.OS === 'ios'
          ? [styles.statusBar, {backgroundColor}]
          : [styles.statusBar, {backgroundColor}]
      }>
      <StatusBar
        translucent={false}
        backgroundColor={backgroundColor}
        barStyle={barStyle}
        hidden={false}
      />
    </SafeAreaView>
  );
};

export default MyStatusBar;

const styles = StyleSheet.create({
  statusBar: {
    height: STATUSBAR_HEIGHT,
  },
});