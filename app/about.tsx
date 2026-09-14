import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { TmdbAttribution } from '../src/compliance/tmdb-attribution';

export default function AboutScreen(){
  return <ScrollView contentContainerStyle={styles.container}>
    <TmdbAttribution/>
    <Link href="/" accessibilityLabel="Back to Otteroom" style={styles.link}>Back to Otteroom</Link>
  </ScrollView>;
}
const styles=StyleSheet.create({
  container:{flexGrow:1,justifyContent:'center',padding:24,gap:24},
  link:{color:'#2457A7',fontSize:18,paddingVertical:12},
});
