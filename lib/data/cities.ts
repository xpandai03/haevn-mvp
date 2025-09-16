export const cities = [
  { id: '1', name: 'New York', zipCodes: ['10001', '10002', '10003', '10004', '10005'], status: 'live' as const },
  { id: '2', name: 'Los Angeles', zipCodes: ['90001', '90002', '90003', '90004'], status: 'live' as const },
  { id: '3', name: 'Chicago', zipCodes: ['60601', '60602', '60603'], status: 'waitlist' as const },
  { id: '4', name: 'San Francisco', zipCodes: ['94102', '94103', '94104'], status: 'live' as const },
  { id: '5', name: 'Austin', zipCodes: ['78701', '78702', '78703'], status: 'waitlist' as const },
]

export function checkCityStatus(zipCode: string) {
  const city = cities.find(c => c.zipCodes.includes(zipCode))
  return city || null
}