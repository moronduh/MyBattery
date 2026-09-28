//
//  QuickAddWidgetLiveActivity.swift
//  QuickAddWidget
//
//  Created by Miranda Johnson on 6/15/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct QuickAddWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct QuickAddWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: QuickAddWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension QuickAddWidgetAttributes {
    fileprivate static var preview: QuickAddWidgetAttributes {
        QuickAddWidgetAttributes(name: "World")
    }
}

extension QuickAddWidgetAttributes.ContentState {
    fileprivate static var smiley: QuickAddWidgetAttributes.ContentState {
        QuickAddWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: QuickAddWidgetAttributes.ContentState {
         QuickAddWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: QuickAddWidgetAttributes.preview) {
   QuickAddWidgetLiveActivity()
} contentStates: {
    QuickAddWidgetAttributes.ContentState.smiley
    QuickAddWidgetAttributes.ContentState.starEyes
}
