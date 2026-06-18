Pod::Spec.new do |s|
  s.name           = 'IronPathWatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WCSession bridge for the IronPath watchOS companion'
  s.description    = 'Pushes active workout state to the paired Apple Watch and emits set-completion events back to React Native.'
  s.author         = 'IronPath'
  s.homepage       = 'https://tryironpath.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity', 'HealthKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
