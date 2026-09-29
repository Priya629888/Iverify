import {Platform, ToastAndroid} from 'react-native';
import Toast from 'react-native-simple-toast';

const ShowAlert = (message: string, isLong: boolean = false): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(
      message,
      isLong ? ToastAndroid.LONG : ToastAndroid.SHORT,
    );
  } else {
    Toast.showWithGravity(
      message,
      isLong ? Toast.LONG : Toast.SHORT,
      Toast.BOTTOM,
    );
  }
};

export default ShowAlert;