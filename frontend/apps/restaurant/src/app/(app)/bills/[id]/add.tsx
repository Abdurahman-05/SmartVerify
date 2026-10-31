import { useLocalSearchParams } from 'expo-router';

import NewOrderScreen from '@/features/orders/NewOrderScreen';

/** More items for an open bill. */
export default function AddToBillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NewOrderScreen addTo={id} />;
}
