import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  TextInput,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  Alert,
  StyleProp,
  ViewStyle,
  TextStyle,
  ImageSourcePropType,
  KeyboardTypeOptions,
} from 'react-native';
import {COLORS,  Fonts,  IMAGES} from '../Themes/Themes';
import normalize from '../utils/helpers/normalize';
// import {Fonts} from '../themes/Fonts';

// ---- Props Interface (TypeScript version of PropTypes) ----
interface TextInputWithButtonProps {
  marginLeft?: number;
  marginTop?: number;
  maxLength?: number;
  isSecure?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: KeyboardTypeOptions;
  value?: string;
  onChangeText?: (text: string) => void;
  color?: string;
  letterSpacing?: number;
  fontSize?: number;
  editable?: boolean;
  borderColor?: string;
  fontWeight?: TextStyle['fontWeight'];
  textAlign?: 'left' | 'center' | 'right';
  onPress?: () => void;
  search?: boolean;
  borderRadius?: number;
  borderRadiusLeftRadius?: number;
  borderBottomRadiusRightRadius?: number;
  icon?: any;
  iconleft?: any;
  iconright?: any;
  fontFamily?: string;
  backgroundColor?: string;
  width?: string | number;
  height?: string | number;
  marginBottom?: number;
  borderWidth?: number;
  leftIcon?: string;
  rightIcon?: string;
  isleftIconVisible?: boolean;
  isRightIconVisible?: boolean;
  textInputLeft?: number;
  textColor?: string;
  doller?: boolean;
  elevation?: number;
  shadowRadius?: number;
  shadowOpacity?: number;
  shadowOffset?: {width: number; height: number} | null;
  shadowColor?: string;
  viewbordercolor?: string;
  rightimage?: ImageSourcePropType;
  leftimage?: ImageSourcePropType;
  rightimageheight?: number;
  rightimagewidth?: number;
  leftimageheight?: number;
  leftimagewidth?: number;
  secureTextEntry?: boolean;
  isheadertext?: boolean;
  headertext?: string;
  headertxtcolor?: string;
  headertxtsize?: number;
  tintColor?: string;
  borderBottomColor?: string | null;
  focus?: boolean;
  show?: boolean;
}

export default function TextInputWithButton(props: TextInputWithButtonProps) {
  const inputRef = useRef<TextInput>(null);
  const [blurview, setblurview] = useState<boolean>(false);
  const [headerTaxt, setHeaderTaxt] = useState<boolean>(false);

  // ---- Default values (same as defaultProps) ----
  const {
    shadowOffset = null,
    shadowRadius = 0,
    shadowOpacity = 0,
    elevation = 0,
    marginTop = 0,
    maxLength = 40,
    isSecure = false,
    multiline = false,
    autoCapitalize = 'none',
    placeholder = '',
    placeholderTextColor = COLORS.black,
    keyboardType = 'default',
    value = '',
    onChangeText: onChangeTextProp,
    color = COLORS.black,
    editable = true,
    borderColor = '#DDDDDD',
    letterSpacing = 0,
    fontSize = normalize(12),
    textAlign = 'left',
    borderRadius = normalize(5),
    icon = null,
    iconleft = null,
    borderBottomColor = null,
    fontWeight = '400',
    backgroundColor = '',
    search = false,
    width = '100%',
    height = normalize(42),
    marginBottom = normalize(15),
    borderWidth = 0,
    leftIcon = '',
    rightIcon = '',
    isleftIconVisible = false,
    isRightIconVisible = false,
    textInputLeft = 0,
    textColor = COLORS.black,
    doller = false,
    rightimageheight = normalize(20),
    rightimagewidth = normalize(20),
    leftimageheight = normalize(20),
    leftimagewidth = normalize(20),
    isheadertext = false,
    headertxtcolor = '#848484',
    headertxtsize = normalize(12),
    fontFamily,
    tintColor,
    leftimage,
    rightimage,
    headertext,
    focus,
    onPress: onPressProp,
    secureTextEntry,
    show,
  } = props;

  function onChangeText(text: string) {
    if (onChangeTextProp) {
      onChangeTextProp(text);
    }
  }

  function onPress() {
    if (onPressProp) {
      onPressProp();
    }
  }

  useEffect(() => {
    if (focus === true) {
      // Platform.OS === 'ios'
      //   ? inputRef.current.focus()
      //   :
      setTimeout(() => inputRef.current?.focus(), 600);
    }
  }, [focus]);

  return (
    <>
      <View
        style={{
          backgroundColor: backgroundColor,
          borderRadius: borderRadius,
          alignItems: 'flex-start',
          justifyContent: 'center',
          marginBottom: marginBottom,
          marginTop: marginTop,
          shadowColor: '#024BAD',
          shadowOffset: {width: 0, height: 3},
          shadowOpacity: show && isheadertext ? 1 : 0,
          shadowRadius: 1,
          elevation: 15,
        }}>
        {show && isheadertext && (
          <Text
            style={{
            //   fontFamily: Fonts.PoppinsRegular,
              color: '#446189', //headertxtcolor,
              fontSize: headertxtsize,
              marginTop: normalize(5),
              marginBottom: normalize(-10),
              marginLeft: normalize(45),
            }}>
            {headertext}
          </Text>
        )}
        <View
          style={{
            flexDirection: 'row',
            width: width as any,
            alignItems: 'center',
            height: height as any,
            borderWidth: borderWidth,
            borderColor: borderColor, //viewbordercolor?viewbordercolor: '#C1C1C1',
            borderRadius: borderRadius,
            borderBottomColor: borderBottomColor as any,
            paddingHorizontal: normalize(10),
            justifyContent: 'space-between',
          }}>
          {isleftIconVisible && (
            <TouchableOpacity onPress={() => onPress()}>
              <Image
                source={leftimage}
                resizeMode="contain"
                style={{
                  width: normalize(14),
                  height: normalize(16),
                  tintColor: tintColor,
                  marginLeft: normalize(5),
                  marginRight: normalize(10),
                }}
              />
            </TouchableOpacity>
          )}

          <TextInput
            ref={inputRef}
            style={[
              {
                flex: 1,
                paddingLeft: textInputLeft,
                textAlign: textAlign,
                letterSpacing: letterSpacing,
                color: textColor,
                fontFamily: fontFamily,
                fontSize: fontSize,
                paddingRight: normalize(0),
                elevation: elevation,
              } as TextStyle,
            ]}
            maxLength={maxLength}
            multiline={multiline}
            autoCapitalize={autoCapitalize}
            placeholder={placeholder}
            editable={editable}
            spellCheck={false}
            placeholderTextColor={placeholderTextColor}
            keyboardType={keyboardType}
            value={value}
            onChangeText={text => {
              onChangeText(text);
            }}
            onBlur={() => {
              setblurview(false);
              console.log('hi');
            }}
            onFocus={() => setblurview(true)}
            secureTextEntry={secureTextEntry}
          />
          {isRightIconVisible && (
            <TouchableOpacity onPress={() => onPress()}>
              <Image
                source={rightimage}
                resizeMode="contain"
                style={{
                  width: rightimageheight,
                  height: rightimagewidth,
                  tintColor: tintColor,
                  marginRight: normalize(10),
                  marginLeft: normalize(10),
                }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}