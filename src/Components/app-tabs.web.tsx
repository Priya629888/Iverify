
import { StyleSheet, Text, View } from 'react-native';

export default function AppTabs() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Web tabs are not supported in this CLI app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});
