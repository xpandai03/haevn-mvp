**🧠 HAEVN Onboarding Survey UI/UX Update Specification (Nov 2025)**
====================================================================

* * * * *

**🎯 Objective**
----------------

Modernize and align the **onboarding survey UI** with HAEVN's brand guidelines, improving visual feedback, mobile responsiveness, and section differentiation while maintaining clarity and speed.

* * * * *

**🧩 Core Areas of Change**
---------------------------

### **1. **

### **Progress System Overhaul**

-   **Add Dynamic Progress Bar** across top of screen.

    -   Progress fills based on *actual completion percentage* (not static).

    -   **Color dynamically changes** depending on the section user is in.

    -   Smooth color fade transition between sections.

    -   Progress bar thickness: 6--8px with rounded edges.

-   **Completion Percentage Check:**

    -   Audit logic for accurate percentage based on total answered questions vs total.

    -   Display numerical percentage only if consistent with bar progression.

### **2. **

### **Section-Based Color System (Brand-Aligned)**

|

**#**

 |

**Section**

 |

**Label**

 |

**Brand-Driven Color**

 |

**Secondary Accent**

 |
| --- | --- | --- | --- | --- |
|

1

 |

basic_demographics

 |

Basic Information

 |

#E29E0C (Gold Yellow)

 |

Light amber glow (#E29E0C @ 40%)

 |
|

2

 |

relationship_preferences

 |

Relationship Preferences

 |

#E29E0C

 |

Gradient Gold→White glow

 |
|

3

 |

communication_attachment

 |

Communication & Connection

 |

#008080 (Teal Blue)

 |

Teal glow @ 35% opacity

 |
|

4

 |

lifestyle_values

 |

Lifestyle & Values

 |

#008080 mix w/ #EBE6E3

 |

Muted teal glow

 |
|

5

 |

privacy_community

 |

Privacy & Community

 |

#1E24AA (Navy Blue)

 |

Soft violet-blue glow

 |
|

6

 |

intimacy_sexuality

 |

Intimacy & Sexuality

 |

#252627 (Charcoal) + gold accent

 |

Warm gold hover accents

 |
|

7

 |

personal_expression

 |

Personal Expression

 |

Gradient #008080→#E29E0C

 |

Subtle animated gradient glow

 |
|

8

 |

personality_insights

 |

Personality Insights

 |

#EBE6E3 (Light Gray)

 |

Minimal teal outline

 |

#### **Implementation Notes**

-   **Glow Layer:** outer box-shadow or filter: drop-shadow based on section color.

-   **Transition:** use fade-in-out (300--400ms) when advancing sections.

-   Color constants should be centrally stored in theme.ts for reuse.

* * * * *

### **3. **

### **Navigation Controls Redesign**

-   Add **glassmorphic borders** to Back and Save & Exit buttons.

    -   Use translucent background (rgba(255,255,255,0.15)), blurred backdrop (backdrop-filter: blur(12px)), and subtle border glow (rgba(255,255,255,0.25)).

    -   Hover state: amplify glow using active section color.

    -   Maintain consistent padding and icon alignment.

-   Ensure **CTA consistency**:

    -   Continue button uses section color as background.

    -   On hover: lighten color by 10--15%.

    -   Rounded pill shape retained.

* * * * *

### **4. **

### **Mobile Responsiveness (≤ 400px)**

-   Card padding: increase vertical breathing space (top/bottom 32px).

-   Font scaling:

    -   Headline: 18--20px

    -   Subtext: 14px

    -   Slider labels: 12px

-   Ensure buttons don't overflow viewport width.

-   Use max-width: 95vw for card.

-   Add bottom-safe zone spacing for devices with nav bars.

* * * * *

### **5. **

### **Performance Enhancements**

-   Preload next question and section color to reduce lag.

-   Use lightweight animation transitions (transform/opacity only).

-   Lazy-load SVG assets and icons.

-   Maintain 60fps interactions.

* * * * *

**⚙️ Technical Implementation Notes**
-------------------------------------

-   All color variables and effects stored in theme/colors.ts.

-   Progress logic lives in SurveyProgress.tsx (verify mapping by section ID → color).

-   Glass buttons implemented via GlassButton.tsx component for reuse.

-   Test across key breakpoints: 1440px, 1024px, 768px, 400px.

-   Ensure backward compatibility with existing questions.ts section mapping.

* * * * *

**✅ Expected Outcome**
----------------------

-   Stronger brand identity and emotional tone consistency across onboarding.

-   Clearer section differentiation with immersive visual feedback.

-   Faster perceived load times and smoother mobile experience.

-   Cohesive look tied to HAEVN's core brand palette (#E29E0C, #008080, #1E24AA, #252627, #EBE6E3).

* * * * *

### **🧭 Next Step**

Use this spec with Claude as the reference for implementation. Then execute with a build prompt referencing this file to:

1.  Implement color + progress bar logic.

2.  Add glassmorphic controls.

3.  Optimize layout for mobile and performance.