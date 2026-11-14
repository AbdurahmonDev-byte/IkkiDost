import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useRealtime } from '../../lib/realtime';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
}

export default function AppLayout() {
  const role = useAuth((state) => state.user?.role);
  const isOwner = role === 'OWNER';
  useRealtime();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Xonalar',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: 'Yetkazish',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🛵" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Xabarlar',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🔔" focused={focused} />,
        }}
      />
      {isOwner ? (
        <Tabs.Screen
          name="owner"
          options={{
            title: 'Ega',
            tabBarIcon: ({ focused }) => <TabIcon glyph="📊" focused={focused} />,
          }}
        />
      ) : null}
    </Tabs>
  );
}
