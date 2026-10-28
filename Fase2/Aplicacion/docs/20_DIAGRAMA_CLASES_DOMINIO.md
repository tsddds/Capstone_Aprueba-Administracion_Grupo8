# Diagrama de clases del dominio

Este diagrama UML describe entidades y relaciones del dominio almacenado en Firestore. La implementación usa módulos, funciones y objetos JavaScript; los nombres del diagrama no representan clases JavaScript declaradas. Los atributos muestran los nombres de los campos principales del almacenamiento. La notación de clase permite explicar el modelo sin cambiar su implementación documental.

```mermaid
classDiagram
  class AdminUser {
    string id
    string email
    string role
    string passwordHash
    boolean mfaEnabled
  }
  class User {
    string id
    string email
    string plan
    string state
    string lastActivity
    object medals
  }
  class Plan {
    string id
    string name
    number price
    string[] features
    object limits
    number revision
  }
  class Feature {
    string id
    string name
  }
  class Subscription {
    string id
    string userId
    string plan
    string status
    string currentPeriodEnd
  }
  class Ticket {
    string id
    string userId
    string assigneeId
    string state
  }
  class Reply {
    string body
    string actorId
    string createdAt
  }
  class Question {
    string id
    string testId
    string statement
    string[] options
    string correctAnswer
    object explanation
    string status
  }
  class Correction {
    string id
    string userId
    string questionId
    string state
    string note
  }
  class Notification {
    string correctionId
    string message
    boolean read
  }
  class MedalMovement {
    string correctionId
    string tier
    number amount
  }
  class Sponsor {
    string id
    string name
    string status
  }
  class Benefit {
    string id
    number stock
    boolean active
  }
  User "1" --> "0..*" Subscription : userId
  Plan "1" --> "0..*" Subscription : plan
  Plan "0..*" --> "0..*" Feature : features
  User "1" --> "0..*" Ticket : userId
  AdminUser "0..1" --> "0..*" Ticket : assigneeId
  Ticket "1" *-- "0..*" Reply : replies
  User "1" --> "0..*" Correction : userId
  Question "1" --> "0..*" Correction : questionId
  User "1" *-- "0..*" Notification : notifications
  User "1" *-- "0..*" MedalMovement : medalMovements
  Correction "1" --> "0..1" Notification : resolucion
  Correction "1" --> "0..1" MedalMovement : premio
  Sponsor "1" *-- "0..*" Benefit : benefits
```

La composición indica beneficios embebidos o subcolecciones dentro de un documento padre. Las demás asociaciones se resuelven mediante identificadores. Una notificación se crea al resolver; el movimiento de premio solo se crea cuando se confirma la recorrección. Los documentos legados pueden contener referencias ausentes, que el backend debe tratar según el caso.

Se omiten las colecciones auxiliares de métricas, auditoría e idempotencia para mantener legibles las relaciones de negocio. El [modelo de datos](19_MODELO_DATOS_FIRESTORE.md) las detalla, incluye las fuentes revisadas y explica los tipos. `explanation` también admite texto heredado, además del objeto estructurado representado.
