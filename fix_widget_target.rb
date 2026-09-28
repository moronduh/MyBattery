require 'xcodeproj'

PROJECT_PATH = File.expand_path('../ios/App/App.xcodeproj', __FILE__)
project = Xcodeproj::Project.open(PROJECT_PATH)

widget_target = project.native_targets.find { |t| t.name == 'EnergyWidget' }
raise "EnergyWidget target not found!" unless widget_target

# Fix build settings
['Debug', 'Release'].each do |config|
  s = widget_target.build_settings(config)
  s['PRODUCT_NAME']            = 'EnergyWidget'
  s['WRAPPER_EXTENSION']       = 'appex'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'app.web.mindfulstillflow.EnergyWidget'
end

# Remove Info.plist from resources phase (it's processed automatically via INFOPLIST_FILE)
resources_phase = widget_target.resources_build_phase
resources_phase.files.each do |f|
  if f.file_ref&.path =~ /Info\.plist/i
    resources_phase.remove_file_reference(f.file_ref)
    puts "Removed Info.plist from resources phase"
  end
end

project.save
puts "✅ Fixed EnergyWidget build settings"
