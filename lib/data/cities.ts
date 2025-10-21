export const cities = [
  { id: '1', name: 'New York', zipCodes: ['10001', '10002', '10003', '10004', '10005'], status: 'live' as const },
  { id: '2', name: 'Los Angeles', zipCodes: ['90001', '90002', '90003', '90004', '90210'], status: 'live' as const },
  { id: '3', name: 'Chicago', zipCodes: ['60601', '60602', '60603'], status: 'waitlist' as const },
  { id: '4', name: 'San Francisco', zipCodes: ['94102', '94103', '94104'], status: 'live' as const },
  {
    id: '5',
    name: 'Austin',
    zipCodes: [
      // Travis County (Austin proper)
      '73301', '73344', '78701', '78702', '78703', '78704', '78705', '78712', '78717', '78719',
      '78721', '78722', '78723', '78724', '78725', '78726', '78727', '78728', '78729', '78730',
      '78731', '78732', '78733', '78734', '78735', '78736', '78737', '78738', '78739', '78741',
      '78742', '78744', '78745', '78746', '78747', '78748', '78749', '78750', '78751', '78752',
      '78753', '78754', '78755', '78756', '78757', '78758', '78759',
      // Williamson County (Round Rock, Georgetown, Cedar Park, Leander)
      '76574', '78613', '78626', '78628', '78633', '78634', '78641', '78642', '78645', '78660',
      '78664', '78665', '78681', '78682', '78683',
      // Hays County (Kyle, Buda, San Marcos)
      '78610', '78640', '78666', '78667', '78676',
      // Bastrop County (Bastrop, Elgin)
      '78602', '78612', '78621', '78650', '78659', '78662', '78941', '78953', '78957',
      // Caldwell County (Lockhart, Luling)
      '78644', '78648', '78656'
    ],
    status: 'live' as const
  },
]

export function checkCityStatus(zipCode: string) {
  const city = cities.find(c => c.zipCodes.includes(zipCode))
  return city || null
}