Pod::Spec.new do |s|
  s.name           = 'IronPathLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Rest timer Live Activity bridge'
  s.description    = 'Starts, updates, and ends an iOS Live Activity for the workout rest timer.'
  s.author         = 'IronPath'
  s.homepage       = 'https://tryironpath.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
