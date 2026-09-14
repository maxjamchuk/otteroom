import { Image, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

export const tmdbNotice = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
export const tmdbUrl = 'https://www.themoviedb.org';

export function TmdbAttribution() {
  return <View style={styles.container}>
    <Text testID="otteroom-brand" accessibilityRole="header" style={styles.brand}>Otteroom credits</Text>
    <Image testID="tmdb-logo" source={require('../../assets/compliance/tmdb-logo.png')}
      accessible accessibilityRole="image" accessibilityLabel="TMDB logo"
      resizeMode="contain" style={styles.logo}/>
    <Text>{tmdbNotice}</Text>
    <Link href={tmdbUrl} accessibilityLabel="Visit TMDB" style={[styles.link,styles.linkText]}>
      The Movie Database (TMDB)
    </Link>
  </View>;
}

const styles=StyleSheet.create({
  container:{width:'100%',maxWidth:560,gap:16},
  brand:{fontSize:28,fontWeight:'600'},
  logo:{width:160,aspectRatio:330/238,alignSelf:'flex-start'},
  link:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},
  linkText:{color:'#2457A7',fontSize:18},
});
