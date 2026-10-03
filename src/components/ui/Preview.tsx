import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { StatusPill } from './StatusPill';
import { MoneyText } from './MoneyText';
import { Header } from './Header';
import { Switch } from './Switch';
import { Input } from './Input';

export const ComponentPreview = () => {
  const [switchValue, setSwitchValue] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Component Preview" />
      <ScrollView className="flex-1 p-4 gap-6">
        {/* Buttons */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Buttons</Text>
          <Button onPress={() => {}} variant="primary">
            Primary Button
          </Button>
          <Button onPress={() => {}} variant="outline">
            Outline Button
          </Button>
          <Button onPress={() => {}} variant="amber">
            Amber Button
          </Button>
        </View>

        {/* Cards */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Cards</Text>
          <Card>
            <Text className="text-base text-text">This is a card component</Text>
          </Card>
        </View>

        {/* Chips */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Chips</Text>
          <View className="flex-row gap-2 flex-wrap">
            <Chip
              label="Chip 1"
              selected={selectedChip === 'chip1'}
              onPress={() => setSelectedChip('chip1')}
            />
            <Chip
              label="Chip 2"
              selected={selectedChip === 'chip2'}
              onPress={() => setSelectedChip('chip2')}
            />
          </View>
        </View>

        {/* Status Pills */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Status Pills</Text>
          <StatusPill status="verified" />
          <StatusPill status="pending" />
          <StatusPill status="mismatch" />
          <StatusPill status="duplicate" />
        </View>

        {/* Money Text */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Money Text</Text>
          <MoneyText amount={1234.56} />
          <MoneyText amount={100} />
        </View>

        {/* Switch */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Switch</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-text">Toggle me</Text>
            <Switch value={switchValue} onValueChange={setSwitchValue} />
          </View>
        </View>

        {/* Input */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-text">Input</Text>
          <Input
            label="Email"
            placeholder="Enter email"
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="email-address"
          />
        </View>

        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
};
