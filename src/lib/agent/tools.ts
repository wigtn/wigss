/**
 * OpenAI function calling tool definitions for the WIGSS agent.
 * These define the structured outputs the AI can produce when analyzing
 * UI components, providing feedback, and suggesting improvements.
 *
 * Ref: PRD 7.3 - Agent Tool Definitions
 */

export const openaiTools = [
  {
    type: 'function' as const,
    function: {
      name: 'identify_component',
      description: 'DOM 요소 그룹을 하나의 UI 컴포넌트로 인식',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '컴포넌트 이름 (예: Main Navbar)',
          },
          type: {
            type: 'string',
            enum: [
              'navbar',
              'header',
              'hero',
              'grid',
              'card',
              'sidebar',
              'footer',
              'section',
              'form',
              'modal',
            ],
            description: '컴포넌트 유형',
          },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: '소속 DOM 요소 ID 목록',
          },
          sourceFile: {
            type: 'string',
            description: '추정 소스 파일 경로',
          },
          reasoning: {
            type: 'string',
            description: '인식 근거',
          },
        },
        required: ['name', 'type', 'elementIds', 'reasoning'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'provide_feedback',
      description: '레이아웃 변경에 대한 피드백 제공',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'sizing',
              'spacing',
              'alignment',
              'min_size',
              'viewport',
              'overlap',
            ],
            description: '피드백 유형',
          },
          severity: {
            type: 'string',
            enum: ['warning', 'error'],
            description: '심각도',
          },
          message: {
            type: 'string',
            description: '피드백 메시지',
          },
          affectedComponents: {
            type: 'array',
            items: { type: 'string' },
            description: '영향받는 컴포넌트 ID 목록',
          },
          suggestedFix: {
            type: 'object',
            description:
              'Suggested position/size changes as key-value pairs (e.g. { "x": 10, "width": 300 })',
          },
        },
        required: ['type', 'severity', 'message', 'affectedComponents'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_improvement',
      description: '디자인 개선안 제안',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '개선 제안 제목',
          },
          description: {
            type: 'string',
            description: '개선 제안 상세 설명',
          },
          confidence: {
            type: 'number',
            description: '신뢰도 (0-100)',
          },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                componentId: { type: 'string' },
                type: { type: 'string', enum: ['move', 'resize'] },
                from: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
                to: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
              },
            },
            description: '제안하는 변경사항 목록',
          },
        },
        required: ['title', 'description', 'confidence'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modify_overlay',
      description: '오버레이 컴포넌트를 수정 (위임 모드에서 사용)',
      parameters: {
        type: 'object',
        properties: {
          componentId: {
            type: 'string',
            description: '수정할 컴포넌트 ID',
          },
          changes: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            description: '변경할 위치/크기 값',
          },
        },
        required: ['componentId', 'changes'],
      },
    },
  },
] as const;

/** Type-safe tool names derived from the tools array */
export type ToolName = (typeof openaiTools)[number]['function']['name'];
