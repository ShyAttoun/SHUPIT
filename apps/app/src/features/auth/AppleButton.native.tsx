import * as AppleAuthentication from 'expo-apple-authentication';

/** Apple's own button (required look and wording). Rendered only where Sign in with Apple is available. */
export function AppleButton({ onPress, light }: { onPress: () => void; light: boolean }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={
        light
          ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      }
      cornerRadius={24}
      style={{ height: 48, width: '100%' }}
      onPress={onPress}
    />
  );
}
