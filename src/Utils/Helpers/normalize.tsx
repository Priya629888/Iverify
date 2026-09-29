import {Dimensions, PixelRatio} from 'react-native';

const scale = Dimensions.get('window').width / 320;

const normalize = (size: number): number => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export default normalize;