require 'xcodeproj'

PROJECT_PATH = File.expand_path('../ios/App/App.xcodeproj', __FILE__)
WIDGET_DIR   = File.expand_path('../ios/App/EnergyWidget', __FILE__)
APP_GROUP    = 'group.app.web.mindfulstillflow'
TEAM_ID      = 'WFL3LZ7633'
BUNDLE_ID    = 'app.web.mindfulstillflow'

project = Xcodeproj::Project.open(PROJECT_PATH)

# ── 1. Add EnergyWidget target ──────────────────────────────────────────────
widget_target = project.new_target(
  :app_extension,
  'EnergyWidget',
  :ios,
  '15.0',
  project.products_group
)
widget_target.product_type = 'com.apple.product-type.app-extension'
# WidgetKit extensions use this product type
widget_target.build_settings('Debug')['INFOPLIST_FILE'] = 'EnergyWidget/Info.plist'
widget_target.build_settings('Release')['INFOPLIST_FILE'] = 'EnergyWidget/Info.plist'

['Debug', 'Release'].each do |config_name|
  settings = widget_target.build_settings(config_name)
  settings['PRODUCT_BUNDLE_IDENTIFIER']            = "#{BUNDLE_ID}.EnergyWidget"
  settings['SWIFT_VERSION']                         = '5.0'
  settings['TARGETED_DEVICE_FAMILY']               = '1,2'
  settings['IPHONEOS_DEPLOYMENT_TARGET']           = '15.0'
  settings['INFOPLIST_FILE']                        = 'EnergyWidget/Info.plist'
  settings['CODE_SIGN_ENTITLEMENTS']               = 'EnergyWidget/EnergyWidget.entitlements'
  settings['DEVELOPMENT_TEAM']                     = TEAM_ID
  settings['CODE_SIGN_STYLE']                      = 'Automatic'
  settings['LD_RUNPATH_SEARCH_PATHS']              = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  settings['SKIP_INSTALL']                          = 'YES'
  settings['MARKETING_VERSION']                    = '1.0'
  settings['CURRENT_PROJECT_VERSION']              = '1'
end

# ── 2. Add EnergyWidget group and source files ───────────────────────────────
widget_group = project.main_group.new_group('EnergyWidget', 'EnergyWidget')

swift_files  = ['EnergyWidget.swift', 'EnergyWidgetBundle.swift']
plist_file   = 'Info.plist'
entitlements = 'EnergyWidget.entitlements'

swift_refs = swift_files.map do |f|
  ref = widget_group.new_file(f)
  ref.set_explicit_file_type('sourcecode.swift')
  ref
end

plist_ref = widget_group.new_file(plist_file)
plist_ref.set_explicit_file_type('text.plist.xml')

ent_ref = widget_group.new_file(entitlements)

# Add Swift source files to compile phase
sources_phase = widget_target.source_build_phase
swift_refs.each { |ref| sources_phase.add_file_reference(ref) }

# Add Info.plist to resources
resources_phase = widget_target.resources_build_phase
resources_phase.add_file_reference(plist_ref)

# ── 3. Link WidgetKit framework ─────────────────────────────────────────────
frameworks_phase = widget_target.frameworks_build_phase
widgetkit_ref = project.frameworks_group.new_file('System/Library/Frameworks/WidgetKit.framework')
widgetkit_ref.set_explicit_file_type('wrapper.framework')
widgetkit_ref.set_source_tree('<absolute>')
frameworks_phase.add_file_reference(widgetkit_ref)

swiftui_ref = project.frameworks_group.new_file('System/Library/Frameworks/SwiftUI.framework')
swiftui_ref.set_explicit_file_type('wrapper.framework')
swiftui_ref.set_source_tree('<absolute>')
frameworks_phase.add_file_reference(swiftui_ref)

# ── 4. Add Embed Extensions phase to the App target ────────────────────────
app_target = project.native_targets.find { |t| t.name == 'App' }
raise "Could not find App target!" unless app_target

# Embed extension
embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'  # Plug-ins/Extensions

ext_ref = widget_target.product_reference
build_file = embed_phase.add_file_reference(ext_ref)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# ── 5. Add EnergyBridgePlugin & EnergyBridge.m to App target ────────────────
app_group = project.main_group['App']
if app_group
  bridge_swift = app_group.new_file('EnergyBridgePlugin.swift')
  bridge_objc  = app_group.new_file('EnergyBridge.m')

  app_sources = app_target.source_build_phase
  app_sources.add_file_reference(bridge_swift)
  app_sources.add_file_reference(bridge_objc)
end

# ── 6. Save ──────────────────────────────────────────────────────────────────
project.save
puts "✅ EnergyWidget target added to #{PROJECT_PATH}"
puts "   Bundle ID:  #{BUNDLE_ID}.EnergyWidget"
puts "   App Group:  #{APP_GROUP}"
puts "   Files:      #{swift_files.join(', ')}, #{plist_file}"
