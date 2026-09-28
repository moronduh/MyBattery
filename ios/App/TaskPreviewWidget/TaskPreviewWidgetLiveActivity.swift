//
//  TaskPreviewWidgetLiveActivity.swift
//  TaskPreviewWidget
//
//  Created by Miranda Johnson on 6/15/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct TaskPreviewWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct TaskPreviewWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskPreviewWidgetAttributes.self) { context in
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

extension TaskPreviewWidgetAttributes {
    fileprivate static var preview: TaskPreviewWidgetAttributes {
        TaskPreviewWidgetAttributes(name: "World")
    }
}

extension TaskPreviewWidgetAttributes.ContentState {
    fileprivate static var smiley: TaskPreviewWidgetAttributes.ContentState {
        TaskPreviewWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: TaskPreviewWidgetAttributes.ContentState {
         TaskPreviewWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: TaskPreviewWidgetAttributes.preview) {
   TaskPreviewWidgetLiveActivity()
} contentStates: {
    TaskPreviewWidgetAttributes.ContentState.smiley
    TaskPreviewWidgetAttributes.ContentState.starEyes
}
