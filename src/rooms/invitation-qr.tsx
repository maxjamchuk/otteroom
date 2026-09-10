import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type InvitationQrProps = { value: string };

class QrBoundary extends Component<InvitationQrProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.container}>
          <Text accessibilityLiveRegion="polite">QR code unavailable. Please try again.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry QR code"
            style={styles.retry} onPress={() => this.setState({ failed: false })}>
            <Text>Retry QR code</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View accessible accessibilityRole="image" accessibilityLabel="Room invitation QR code"
        style={styles.container}>
        {/* Without onError, encoder failures reach this boundary. The library's
            render-time callback must never schedule a parent state update. */}
        <QRCode value={this.props.value} size={240} quietZone={48}
          ecl="M" color="black" backgroundColor="white" />
      </View>
    );
  }
}

export function InvitationQr({ value }: InvitationQrProps) {
  // A different invitation starts clean; a retry only remounts this same value.
  return <QrBoundary key={value} value={value} />;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 240, alignSelf: 'center', gap: 12 },
  retry: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
});
