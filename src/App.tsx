import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BackHandlerProvider } from './app/context/BackHandler';
import { installDiagnostics } from './diagnostics/install';
import { CacheGate } from './app/context/CacheGate';
import { ConnectivityProvider } from './app/context/Connectivity';
import { LanguageDirection } from './app/context/LanguageDirection';
import { SettingsProvider } from './app/context/Settings';
import { Router } from './app/navigation/Router';
import { FocusProvider } from './ui-kit/focus/FocusProvider';
import { DesignCanvas } from './ui-kit/layout/DesignCanvas';

// Before anything renders, so an error while starting is reported too
installDiagnostics();

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <CacheGate>
          <BackHandlerProvider>
            <ConnectivityProvider>
              <FocusProvider>
                <DesignCanvas>
                  <LanguageDirection>
                    <Router />
                  </LanguageDirection>
                </DesignCanvas>
              </FocusProvider>
            </ConnectivityProvider>
          </BackHandlerProvider>
        </CacheGate>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
